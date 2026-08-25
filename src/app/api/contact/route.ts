import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contactSubmissions } from "@/db/schema";
import { buildContactNotificationEmail } from "@/server/lib/contact-email";
import { sendContactNotificationEmail } from "@/server/lib/contact-email-send";
import { contactSchema, HONEYPOT_FIELD } from "@/server/lib/contact-submit";
import {
  checkRateLimit,
  getClientIp,
  normalizeRateLimitKeyPart,
} from "@/server/lib/rate-limit";
import { buildRdStationConversionPayload } from "@/server/lib/rd-station";
import { sendRdStationConversion } from "@/server/lib/rd-station-send";
import { getPublicProductBySlug } from "@/server/lib/public-products";

/**
 * Rota pública de escrita, atrás de dois limites (IP + global). Mais
 * restrito que `/api/representatives/register` de propósito: aquele precisa
 * tolerar vários pré-cadastros atrás do mesmo NAT de escritório; um
 * formulário de contato não tem essa necessidade legítima de volume por
 * origem, então o teto por IP pode ser bem mais baixo. `productionSafe:
 * true` nas duas chamadas — rota pública de escrita NÃO pode operar sem
 * rate-limit quando o Redis cai (débito já registrado no decisionLog
 * 2026-08-23 para as outras rotas de auth; aqui nasce correto).
 */
const CONTACT_IP_RATE_LIMIT = { windowSeconds: 10 * 60, max: 8, productionSafe: true };
const CONTACT_GLOBAL_RATE_LIMIT = { windowSeconds: 5 * 60, max: 40, productionSafe: true };

/**
 * Recebimento do formulário de contato (`/{locale}/contato`, CTA "Solicite
 * um orçamento"). A linha em `contact_submissions` é gravada ANTES de
 * qualquer canal de saída (RD Station, e-mail) — o lead nunca se perde por
 * causa de uma API de terceiro fora do ar; os dois canais são best-effort e
 * rodam em paralelo, sem bloquear um ao outro nem a resposta ao visitante.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const [ipLimit, globalLimit] = await Promise.all([
      checkRateLimit(`contact:ip:${normalizeRateLimitKeyPart(ip)}`, CONTACT_IP_RATE_LIMIT),
      checkRateLimit("contact:global", CONTACT_GLOBAL_RATE_LIMIT),
    ]);
    if (!ipLimit.allowed || !globalLimit.allowed) {
      const retryAfterSeconds = Math.max(ipLimit.retryAfterSeconds, globalLimit.retryAfterSeconds);
      return NextResponse.json(
        { error: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "validation", fields: [] }, { status: 400 });
    }

    // Honeypot preenchido = bot: sucesso silencioso, nada gravado.
    if (
      typeof body === "object" &&
      body !== null &&
      typeof (body as Record<string, unknown>)[HONEYPOT_FIELD] === "string" &&
      ((body as Record<string, unknown>)[HONEYPOT_FIELD] as string).length > 0
    ) {
      return NextResponse.json({ ok: true }, { status: 201 });
    }

    const parsed = contactSchema.safeParse(body);
    if (!parsed.success) {
      const fields = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))];
      return NextResponse.json({ error: "validation", fields }, { status: 400 });
    }

    const input = parsed.data;

    // Resolve o contexto de produto no SERVIDOR (nunca cru do body) — um
    // slug inválido/expirado não deve bloquear a submissão, só some do
    // contexto enviado ao RD Station/e-mail.
    let productName: string | undefined;
    let productSku: string | undefined;
    if (input.productSlug) {
      try {
        const product = await getPublicProductBySlug(input.productSlug);
        if (product) {
          productName =
            input.locale === "en" && product.nameEn ? product.nameEn : product.namePt;
          productSku = product.sku;
        }
      } catch (error) {
        console.error("[api/contact] Falha ao resolver productSlug — ignorando contexto.", error);
      }
    }

    const clientTrackingId = crypto.randomUUID();

    let submissionId: string;
    try {
      const [submission] = await db
        .insert(contactSubmissions)
        .values({
          subject: input.subject,
          name: input.name,
          email: input.email,
          phone: input.phone,
          companyName: input.companyName ?? null,
          cnpj: input.cnpj ?? null,
          message: input.message ?? null,
          productSlug: input.productSlug ?? null,
          productName: productName ?? null,
          productSku: productSku ?? null,
          locale: input.locale,
          clientTrackingId,
          consentGranted: input.consent,
          consentAt: input.consent ? new Date() : null,
          ip: ip === "unknown" ? null : ip.slice(0, 45),
          userAgent: request.headers.get("user-agent"),
        })
        .returning({ id: contactSubmissions.id });
      submissionId = submission.id;
    } catch (error) {
      // Único ponto realmente crítico do fluxo: sem a linha gravada não há
      // lead para recuperar depois. Falha aqui interrompe a request.
      console.error("[api/contact] Falha ao gravar submissão — abortando.", error);
      return NextResponse.json({ error: "internal" }, { status: 500 });
    }

    // Canais de saída, em paralelo, best-effort — nenhum bloqueia o outro.
    // O AWAIT (com timeout de 8s embutido em cada função) roda antes da
    // resposta ao visitante: o processo é persistente (Docker standalone,
    // não serverless/edge com freeze pós-resposta), então não há motivo
    // para ambiguidade sobre execução após a resposta, e o status gravado
    // no banco fica sempre condizente com o que foi de fato tentado.
    const rdPayload = buildRdStationConversionPayload(input, {
      clientTrackingId,
      productName,
      productSku,
    });
    const emailContent = buildContactNotificationEmail(input, { productName, productSku });

    const [rdResult, emailResult] = await Promise.allSettled([
      sendRdStationConversion(rdPayload),
      sendContactNotificationEmail(emailContent, input.email),
    ]);

    const rdStationStatus = rdResult.status === "fulfilled" && rdResult.value.ok ? "sent" : "failed";
    const rdStationEventUuid = rdResult.status === "fulfilled" ? rdResult.value.eventUuid ?? null : null;
    const rdStationError =
      rdResult.status === "fulfilled" ? rdResult.value.error ?? null : String(rdResult.reason);

    const emailStatus = emailResult.status === "fulfilled" && emailResult.value.ok ? "sent" : "failed";
    const emailError =
      emailResult.status === "fulfilled" ? emailResult.value.error ?? null : String(emailResult.reason);

    try {
      await db
        .update(contactSubmissions)
        .set({
          rdStationStatus,
          rdStationEventUuid,
          rdStationError,
          emailStatus,
          emailError,
          updatedAt: new Date(),
        })
        .where(eq(contactSubmissions.id, submissionId));
    } catch (error) {
      // A resposta ao visitante já vai ser enviada de qualquer forma — só logamos.
      console.error("[api/contact] Falha ao atualizar status dos canais de saída.", error);
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("[api/contact]", error);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
