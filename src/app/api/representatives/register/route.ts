import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, representatives, users } from "@/db/schema";
import {
  HONEYPOT_FIELD,
  registerSchema,
} from "@/server/lib/representative-register";
import {
  checkRateLimit,
  getClientIp,
  normalizeRateLimitKeyPart,
} from "@/server/lib/rate-limit";
import { formatCNPJ } from "@/shared/components/contact-form/cnpj";
import { formatPhoneBR } from "@/shared/lib/phone";

/** Mesmo custo do seed do admin (`src/db/seed.ts`) — consistência de política. */
const BCRYPT_COST = 12;

/**
 * Por IP: folgado o bastante para vários visitantes atrás do MESMO IP (NAT de
 * escritório; localmente TODO host chega como o gateway do Docker — 5/10min
 * bloqueou o primeiro teste manual real). O teto global é quem limita spam em
 * volume; o por-IP só corta rajadas de uma origem.
 */
const REGISTER_IP_RATE_LIMIT = { windowSeconds: 10 * 60, max: 20 };
const REGISTER_GLOBAL_RATE_LIMIT = { windowSeconds: 5 * 60, max: 60 };

/**
 * Pré-cadastro público de representante comercial (canal do site).
 *
 * Cria `user` (com hash bcrypt da senha — login por credenciais; o Google SSO
 * com o MESMO e-mail também passa a funcionar) + `representatives` já em
 * status `submitted`: o cadastro nasce na fila de aprovação do time interno
 * (`/portal/representantes`). Nenhuma role é concedida aqui — a role
 * `representative` só vem na aprovação (`representatives.review`), como no
 * fluxo de onboarding original.
 *
 * Erros de duplicidade são respondidos com código específico (`email_exists`/
 * `cnpj_exists`): enumeração via formulário de cadastro é trade-off aceito
 * (UX de "faça login" vale mais), mitigada pelo rate limit por IP.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const [ipLimit, globalLimit] = await Promise.all([
      checkRateLimit(
        `register:ip:${normalizeRateLimitKeyPart(ip)}`,
        REGISTER_IP_RATE_LIMIT
      ),
      checkRateLimit("register:global", REGISTER_GLOBAL_RATE_LIMIT),
    ]);
    if (!ipLimit.allowed || !globalLimit.allowed) {
      const retryAfterSeconds = Math.max(
        ipLimit.retryAfterSeconds,
        globalLimit.retryAfterSeconds
      );
      return NextResponse.json(
        { error: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "validation" }, { status: 400 });
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

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      const fields = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))];
      return NextResponse.json({ error: "validation", fields }, { status: 400 });
    }

    const input = parsed.data;
    const cnpj = formatCNPJ(input.cnpj);
    const phone = formatPhoneBR(input.phone);

    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);
    if (existingUser) {
      return NextResponse.json({ error: "email_exists" }, { status: 409 });
    }

    const [existingCnpj] = await db
      .select({ id: representatives.id })
      .from(representatives)
      .where(eq(representatives.cnpj, cnpj))
      .limit(1);
    if (existingCnpj) {
      return NextResponse.json({ error: "cnpj_exists" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
    const now = new Date();

    const representativeId = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          name: input.name,
          email: input.email,
          passwordHash,
          active: true,
        })
        .returning({ id: users.id });

      const [representative] = await tx
        .insert(representatives)
        .values({
          userId: user.id,
          status: "submitted",
          submittedAt: now,
          companyName: input.companyName,
          cnpj,
          phone,
        })
        .returning({ id: representatives.id });

      // Auditoria direta (sem `writeAuditLog`, que exige sessão): o ator é o
      // próprio usuário recém-criado, com o IP do request como contexto.
      await tx.insert(auditLogs).values({
        userId: user.id,
        action: "representatives.register",
        resource: "representatives",
        resourceId: representative.id,
        metadata: { channel: "site" },
        ip: ip === "unknown" ? null : ip.slice(0, 45),
      });

      return representative.id;
    });

    console.info(`[api/representatives/register] Pré-cadastro recebido (${representativeId}).`);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("[api/representatives/register]", error);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
