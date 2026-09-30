import { after, NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, auditLogs, representatives, userRoles, users } from "@/db/schema";
import { mailboxRateLimitKey } from "@/server/lib/account-tokens";
import { enforceAccountLimits, ipLimitKey, readJsonBody } from "@/server/lib/account-route";
import { purgeStaleAccountData, sendVerificationEmail } from "@/server/lib/account-service";
import {
  HONEYPOT_FIELD,
  isUnconfirmedPreRegistration,
  registerSchema,
} from "@/server/lib/representative-register";
import { getClientIp } from "@/server/lib/rate-limit";
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
 * Por caixa de destino (sem o `+tag`): cada pré-cadastro manda um e-mail da
 * ROCO para o endereço digitado — sem este teto, o formulário viraria um
 * disparador de e-mails para uma pessoa que não pediu nada.
 */
const REGISTER_MAILBOX_RATE_LIMIT = { windowSeconds: 60 * 60, max: 3 };

/** Violação de índice único do Postgres (dois pré-cadastros simultâneos com o mesmo e-mail). */
const UNIQUE_VIOLATION = "23505";

/** Código do erro do banco sem o objeto do erro (que traz os parâmetros da consulta). */
function dbErrorCode(error: unknown): string | undefined {
  const withCode = error as { code?: unknown; cause?: { code?: unknown } } | null;
  const code = withCode?.cause?.code ?? withCode?.code;
  return typeof code === "string" ? code : undefined;
}

/**
 * Pré-cadastro público de representante comercial (canal do site).
 *
 * Cria `user` (hash bcrypt da senha, e-mail AINDA NÃO confirmado) +
 * `representatives` em `draft`, e manda por e-mail o link de confirmação
 * (`/portal/confirmar-email`). Só ao confirmar o e-mail o cadastro vai para a
 * fila de aprovação do time interno (`submitted`, ver `confirmEmail`) — assim
 * a fila não recebe cadastro com e-mail de outra pessoa ou inexistente, e o
 * login por senha fica bloqueado até a confirmação. Nenhuma role é concedida
 * aqui: `representative` só vem na aprovação (`representatives.review`).
 *
 * CNPJ já usado só por pré-cadastros que AINDA NÃO confirmaram o e-mail não
 * bloqueia: o novo é criado ao lado deles, sem apagar nenhum
 * (`isUnconfirmedPreRegistration`); o primeiro a confirmar entra na fila. Os
 * que nunca confirmam somem depois de alguns dias (`purgeStaleAccountData`,
 * que roda depois de cada pré-cadastro).
 *
 * Ordem das checagens: limite por IP ANTES de ler o corpo (lixo gasta a cota
 * de quem o manda); corpo só JSON e com teto de tamanho; honeypot e schema; e
 * só então o teto global e o por destinatário — um flood de requisições
 * inválidas não esgota a cota de quem se cadastra de verdade.
 *
 * Erros de duplicidade são respondidos com código específico (`email_exists`/
 * `cnpj_exists`): enumeração via formulário de cadastro é trade-off aceito
 * (UX de "faça login" vale mais), mitigada pelos limites. Os limites são
 * fail-closed (`productionSafe`): sem Redis, a rota recusa (503).
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    const byIp = await enforceAccountLimits([{ key: ipLimitKey("register", request), ...REGISTER_IP_RATE_LIMIT }]);
    if (byIp) return byIp;

    const body = await readJsonBody(request);
    if (!body) {
      return NextResponse.json({ error: "validation" }, { status: 400 });
    }

    // Honeypot preenchido = bot: sucesso silencioso, nada gravado.
    const honeypot = body[HONEYPOT_FIELD];
    if (typeof honeypot === "string" && honeypot.length > 0) {
      return NextResponse.json({ ok: true }, { status: 201 });
    }

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      const fields = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))];
      return NextResponse.json({ error: "validation", fields }, { status: 400 });
    }

    const input = parsed.data;

    const byVolume = await enforceAccountLimits([
      { key: "register:global", ...REGISTER_GLOBAL_RATE_LIMIT },
      { key: mailboxRateLimitKey("register", input.email), ...REGISTER_MAILBOX_RATE_LIMIT },
    ]);
    if (byVolume) return byVolume;

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

    // O CNPJ não é único no banco: pode haver mais de um cadastro com ele.
    const sameCnpj = await db
      .select({
        status: representatives.status,
        submitted: sql<boolean>`${representatives.submittedAt} is not null`,
        emailVerified: sql<boolean>`${users.emailVerified} is not null`,
        hasPassword: sql<boolean>`${users.passwordHash} is not null`,
        hasOAuthAccount: sql<boolean>`exists (select 1 from ${accounts} where ${accounts.userId} = ${users.id})`,
        hasRoles: sql<boolean>`exists (select 1 from ${userRoles} where ${userRoles.userId} = ${users.id})`,
      })
      .from(representatives)
      .innerJoin(users, eq(users.id, representatives.userId))
      .where(eq(representatives.cnpj, cnpj));
    if (!sameCnpj.every(isUnconfirmedPreRegistration)) {
      return NextResponse.json({ error: "cnpj_exists" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
    const now = new Date();

    const created = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          name: input.name,
          email: input.email,
          passwordHash,
          active: true,
          // Confirmado só pelo link do e-mail (`confirmEmail`).
          emailVerified: null,
        })
        .returning({ id: users.id });

      // Rascunho até o e-mail ser confirmado: fora da fila de aprovação.
      const [representative] = await tx
        .insert(representatives)
        .values({
          userId: user.id,
          status: "draft",
          submittedAt: null,
          companyName: input.companyName,
          cnpj,
          phone,
          updatedAt: now,
        })
        .returning({ id: representatives.id });

      // Auditoria direta (sem `writeAuditLog`, que exige sessão): o ator é o
      // próprio usuário recém-criado, com o IP do request como contexto.
      await tx.insert(auditLogs).values({
        userId: user.id,
        action: "representatives.register",
        resource: "representatives",
        resourceId: representative.id,
        metadata: {
          channel: "site",
          awaitingEmailVerification: true,
          ...(sameCnpj.length > 0 && { unconfirmedWithSameCnpj: sameCnpj.length }),
        },
        ip: ip === "unknown" ? null : ip.slice(0, 45),
      });

      return { userId: user.id, representativeId: representative.id };
    });

    // Depois da resposta: SMTP lento ou fora do ar não trava nem derruba o
    // cadastro — a pessoa pode pedir outro link na tela de sucesso.
    after(() =>
      sendVerificationEmail(db, {
        user: { id: created.userId, email: input.email, name: input.name },
        locale: input.locale ?? "pt",
        ip,
      })
    );
    // Limpeza sem job agendado: pré-cadastros nunca confirmados e links velhos.
    after(async () => {
      const purged = await purgeStaleAccountData(db);
      if (purged.accounts > 0 || purged.tokens > 0) {
        console.info(
          `[api/representatives/register] Limpeza: ${purged.accounts} pré-cadastro(s) nunca confirmado(s), ${purged.tokens} link(s) de conta antigo(s).`
        );
      }
    });

    console.info(`[api/representatives/register] Pré-cadastro recebido (${created.representativeId}), aguardando confirmação de e-mail.`);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    const code = dbErrorCode(error);
    // Dois pré-cadastros simultâneos com o mesmo e-mail: o segundo esbarra no
    // índice único — é o mesmo caso do `email_exists`.
    if (code === UNIQUE_VIOLATION) {
      return NextResponse.json({ error: "email_exists" }, { status: 409 });
    }
    // Sem o objeto do erro no log: o erro do Drizzle traz os parâmetros da
    // consulta — nome, e-mail e o hash da senha.
    console.error(`[api/representatives/register] Falha ao gravar o pré-cadastro${code ? ` (código ${code})` : ""}.`);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
