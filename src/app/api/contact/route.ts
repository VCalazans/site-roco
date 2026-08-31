import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contactSubmissionItems, contactSubmissions } from "@/db/schema";
import { buildContactNotificationEmail } from "@/server/lib/contact-email";
import { sendContactNotificationEmail } from "@/server/lib/contact-email-send";
import { contactSchema, HONEYPOT_FIELD } from "@/server/lib/contact-submit";
import {
  checkRateLimit,
  getClientIp,
  normalizeRateLimitKeyPart,
} from "@/server/lib/rate-limit";
import { isStatementTimeout } from "@/server/lib/pg-error";
import { buildRdStationConversionPayload } from "@/server/lib/rd-station";
import { sendRdStationConversion } from "@/server/lib/rd-station-send";
import { getPublicProductBySlug, getPublicProductsBySlugs } from "@/server/lib/public-products";

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

/**
 * Teto GLOBAL: backstop contra flood distribuído, não um limite de conversão.
 * Ele é compartilhado por TODOS os formulários públicos que caem aqui
 * (`/contato`, `/catalogo` e o carrinho de cotação), e um disparo de e-mail
 * marketing pode gerar dezenas de downloads legítimos em poucos minutos —
 * por isso 200/5min, e não o 40/5min original, que já era apertado para um
 * funil só.
 *
 * Ele é cobrado DEPOIS do honeypot e do parse (ver a ordem no handler):
 * requisição malformada, bot e request já barrada por IP não podem gastar o
 * orçamento compartilhado, senão estourar o balde sai mais barato do que
 * usá-lo e qualquer um derruba a captação de leads do site inteiro.
 */
const CONTACT_GLOBAL_RATE_LIMIT = { windowSeconds: 5 * 60, max: 200, productionSafe: true };

type NewContactSubmission = typeof contactSubmissions.$inferInsert;
type NewContactSubmissionItem = typeof contactSubmissionItems.$inferInsert;

/**
 * Item de carrinho já RESOLVIDO no servidor (nome/SKU vindos do catálogo,
 * quantidade vinda do cliente) — a forma comum consumida pelo INSERT
 * transacional, pelo payload do RD Station e pelo corpo do e-mail.
 */
type ResolvedCartItem = { productSlug: string; productName: string; productSku: string; quantity: number };

/**
 * Tenta uma operação, e UMA segunda vez quando o Postgres cancelou por
 * `statement_timeout` (SQLSTATE `57014`).
 *
 * MOTIVO: o teto de 15 s do pool (`src/db/index.ts`) conta o tempo desde que
 * o comando chega ao servidor — espera por LOCK inclusive. Um `CREATE INDEX`
 * de migration rodando no boot de um container novo (as migrations rodam
 * sozinhas no boot) segura `ACCESS EXCLUSIVE` sobre esta tabela por minutos
 * enquanto o container antigo ainda serve tráfego; nessa janela a escrita do
 * lead não faz trabalho nenhum, só espera — e morre com 57014. Sem este
 * retry, cada visitante que enviasse o formulário nesse intervalo receberia
 * 500 e o lead seria descartado, que é exatamente a falha "LEAD PERDIDO"
 * usada para recusar o `connectionTimeoutMillis` no pool.
 *
 * Uma tentativa só, e sem espera: se o lock já foi liberado, a segunda passa
 * na hora; se ainda não foi, insistir mais só prenderia um slot do pool por
 * mais 15 s. O pior caso do request é ~30 s, e é caso de cauda.
 */
async function withStatementTimeoutRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isStatementTimeout(error)) {
      throw error;
    }
    console.warn(
      "[api/contact] Escrita do lead cancelada por statement_timeout (provável espera " +
        "por lock) — tentando uma segunda vez."
    );
    return operation();
  }
}

async function insertSubmission(values: NewContactSubmission): Promise<string> {
  const [submission] = await db
    .insert(contactSubmissions)
    .values(values)
    .returning({ id: contactSubmissions.id });
  return submission.id;
}

/** Grava o lead singular (subjects call_back/quote/general/catalog), com retry de statement_timeout. */
async function insertSubmissionWithRetry(values: NewContactSubmission): Promise<string> {
  return withStatementTimeoutRetry(() => insertSubmission(values));
}

/**
 * Grava o lead de CARRINHO (`subject: "cart"`) — a linha em
 * `contact_submissions` (sem `productSlug`/`productName`/`productSku`
 * singulares, ficam `null`) e os N itens em `contact_submission_items`,
 * DENTRO DE UMA TRANSAÇÃO: ou os dois existem, ou nenhum.
 */
async function insertCartSubmission(
  values: NewContactSubmission,
  items: ResolvedCartItem[]
): Promise<string> {
  return db.transaction(async (tx) => {
    const [submission] = await tx
      .insert(contactSubmissions)
      .values(values)
      .returning({ id: contactSubmissions.id });

    const itemValues: NewContactSubmissionItem[] = items.map((item, index) => ({
      submissionId: submission.id,
      productSlug: item.productSlug,
      productName: item.productName,
      productSku: item.productSku,
      quantity: item.quantity,
      sortOrder: index,
    }));
    await tx.insert(contactSubmissionItems).values(itemValues);

    return submission.id;
  });
}

/** Mesma garantia de retry do caminho singular, aplicada à transação inteira. */
async function insertCartSubmissionWithRetry(
  values: NewContactSubmission,
  items: ResolvedCartItem[]
): Promise<string> {
  return withStatementTimeoutRetry(() => insertCartSubmission(values, items));
}

/** 429 (teto estourado) ou 503 (limitador fora do ar) — nunca colapsados. */
function rateLimitResponse(result: { retryAfterSeconds: number; unavailable?: boolean }) {
  return NextResponse.json(
    { error: result.unavailable ? "unavailable" : "rate_limited" },
    {
      status: result.unavailable ? 503 : 429,
      headers: { "Retry-After": String(result.retryAfterSeconds) },
    }
  );
}

/**
 * Recebimento do formulário de contato (`/{locale}/contato`, CTA "Solicite
 * um orçamento"), do formulário do catálogo (`/{locale}/catalogo`) e do
 * carrinho de cotação (`subject: "cart"`). A linha em `contact_submissions`
 * é gravada ANTES de qualquer canal de saída (RD Station, e-mail) — o lead
 * nunca se perde por causa de uma API de terceiro fora do ar; os dois canais
 * são best-effort e rodam em paralelo, sem bloquear um ao outro nem a
 * resposta ao visitante.
 */
export async function POST(request: NextRequest) {
  try {
    // Teto por IP primeiro: é a chave que o abusador não compartilha com
    // ninguém, então pode (e deve) ser cobrado de qualquer requisição, mesmo
    // malformada.
    const ip = getClientIp(request);
    const ipLimit = await checkRateLimit(
      `contact:ip:${normalizeRateLimitKeyPart(ip)}`,
      CONTACT_IP_RATE_LIMIT
    );
    if (!ipLimit.allowed) {
      return rateLimitResponse(ipLimit);
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

    // Só AGORA o balde compartilhado é cobrado — a submissão já provou ser
    // plausível (passou pelo honeypot e pelo schema). Ver o comentário de
    // `CONTACT_GLOBAL_RATE_LIMIT`.
    const globalLimit = await checkRateLimit("contact:global", CONTACT_GLOBAL_RATE_LIMIT);
    if (!globalLimit.allowed) {
      return rateLimitResponse(globalLimit);
    }

    // Resolve o contexto de produto no SERVIDOR (nunca cru do body) — um
    // slug inválido/expirado não deve bloquear a submissão, só some do
    // contexto enviado ao RD Station/e-mail.
    let productName: string | undefined;
    let productSku: string | undefined;
    if (input.subject !== "cart" && input.productSlug) {
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

    // Carrinho de cotação: resolve TODOS os slugs pedidos numa query só.
    // Itens que não resolverem (slug expirado, despublicado, inventado)
    // simplesmente saem da lista — não bloqueiam a submissão, salvo se
    // NENHUM restar (ver `cart_empty` abaixo).
    let resolvedCartItems: ResolvedCartItem[] = [];
    if (input.subject === "cart") {
      const items = input.items ?? [];
      let resolvedProducts: Awaited<ReturnType<typeof getPublicProductsBySlugs>> = [];
      try {
        resolvedProducts = await getPublicProductsBySlugs(items.map((item) => item.slug));
      } catch (error) {
        console.error("[api/contact] Falha ao resolver itens do carrinho.", error);
      }
      const productsBySlug = new Map(resolvedProducts.map((product) => [product.slug, product]));

      resolvedCartItems = items
        .map((item): ResolvedCartItem | null => {
          const product = productsBySlug.get(item.slug);
          if (!product) return null;
          const name = input.locale === "en" && product.nameEn ? product.nameEn : product.namePt;
          return { productSlug: item.slug, productName: name, productSku: product.sku, quantity: item.quantity };
        })
        .filter((item): item is ResolvedCartItem => item !== null);

      // Depois de filtrar os que não resolveram, a lista ficou vazia: não é
      // "lead pobre", é "não há lead" — nada é gravado.
      if (resolvedCartItems.length === 0) {
        return NextResponse.json({ error: "cart_empty" }, { status: 400 });
      }
    }

    const clientTrackingId = crypto.randomUUID();

    const baseValues = {
      name: input.name,
      email: input.email,
      phone: input.phone,
      companyName: input.companyName ?? null,
      cnpj: input.cnpj ?? null,
      message: input.message ?? null,
      // Rastreio de aquisição: `origin` já veio validado contra a lista
      // fechada pelo schema (valor forjado na URL vira `undefined` →
      // NULL); os UTMs, sanitizados e truncados. Ver `lead-origin`.
      //
      // Carrinho é exceção: a origem de um carrinho é o próprio fluxo do
      // carrinho, não depende de querystring — grava sempre "carrinho",
      // ignorando qualquer `origin` que porventura tenha vindo no body.
      origin: input.subject === "cart" ? "carrinho" : (input.origin ?? null),
      utmSource: input.utmSource ?? null,
      utmMedium: input.utmMedium ?? null,
      utmCampaign: input.utmCampaign ?? null,
      locale: input.locale,
      clientTrackingId,
      consentGranted: input.consent,
      consentAt: input.consent ? new Date() : null,
      ip: ip === "unknown" ? null : ip.slice(0, 45),
      userAgent: request.headers.get("user-agent"),
    } satisfies Omit<NewContactSubmission, "subject" | "productSlug" | "productName" | "productSku">;

    let submissionId: string;
    try {
      if (input.subject === "cart") {
        submissionId = await insertCartSubmissionWithRetry(
          {
            ...baseValues,
            subject: "cart",
            productSlug: null,
            productName: null,
            productSku: null,
          },
          resolvedCartItems
        );
      } else {
        submissionId = await insertSubmissionWithRetry({
          ...baseValues,
          subject: input.subject,
          productSlug: input.productSlug ?? null,
          productName: productName ?? null,
          productSku: productSku ?? null,
        });
      }
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
    const cartItemsMeta =
      input.subject === "cart"
        ? resolvedCartItems.map((item) => ({
            name: item.productName,
            sku: item.productSku,
            quantity: item.quantity,
          }))
        : undefined;

    const rdPayload = buildRdStationConversionPayload(input, {
      clientTrackingId,
      productName,
      productSku,
      cartItems: cartItemsMeta,
    });
    const emailContent = buildContactNotificationEmail(input, {
      productName,
      productSku,
      cartItems: cartItemsMeta,
    });

    const [rdResult, emailResult] = await Promise.allSettled([
      sendRdStationConversion(rdPayload),
      sendContactNotificationEmail(emailContent, input.email),
    ]);

    // `rdStationError` é gravado MESMO no caminho feliz: o envio pode ter
    // sido aceito só depois de derrubar os campos customizados (marcador
    // `validation_retry_ok`, ver `rd-station-send`), e é assim que o time
    // descobre que falta criar um `cf_*` no painel do RD.
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
