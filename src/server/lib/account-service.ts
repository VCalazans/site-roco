import "server-only";
import bcrypt from "bcryptjs";
import { and, eq, gt, inArray, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import type { db as dbClient } from "@/db";
import { accounts, accountTokens, auditLogs, representatives, userRoles, users } from "@/db/schema";
import { isValidCNPJ } from "@/shared/components/contact-form/cnpj";
import { isValidPhoneBR } from "@/shared/lib/phone";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { buildAccountEmail, type AccountEmailKind } from "./account-emails";
import {
  accountTokenExpiry,
  evaluateAccountToken,
  generateAccountToken,
  hashAccountToken,
  type AccountTokenPurpose,
  type AccountTokenState,
} from "./account-tokens";
import { accountPageLink, getAppBaseUrl, type AccountPage } from "./app-url";
import { sendMail, type MailResult } from "./mailer";

/**
 * Regras de conta com banco: links de confirmação de e-mail e de redefinição
 * de senha. As rotas (`src/app/api/account/*`) cuidam de HTTP, rate limit e
 * respostas genéricas; aqui fica o que precisa ser atômico.
 */
type Database = typeof dbClient;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Mesmo custo do pré-cadastro e do seed do admin. */
export const PASSWORD_BCRYPT_COST = 12;

export type AccountUser = { id: string; email: string; name: string | null };

type TokenFailure = Exclude<AccountTokenState, "valid">;

function trimIp(ip: string | null | undefined): string | null {
  return !ip || ip === "unknown" ? null : ip.slice(0, 45);
}

/** Conta ATIVA pelo e-mail (normalizado). `null` se não existe ou está desativada. */
export async function findActiveUserByEmail(db: Database, email: string) {
  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name, emailVerified: users.emailVerified, active: users.active })
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);
  if (!user?.email || !user.active) return null;
  return { id: user.id, email: user.email, name: user.name, emailVerified: user.emailVerified };
}

/** Emite um token e invalida os anteriores do mesmo tipo — só o último link vale. */
async function issueAccountToken(
  db: Database,
  params: { userId: string; purpose: AccountTokenPurpose; ip?: string | null }
): Promise<string> {
  const { token, tokenHash } = generateAccountToken();
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(accountTokens)
      .set({ usedAt: now })
      .where(
        and(eq(accountTokens.userId, params.userId), eq(accountTokens.purpose, params.purpose), isNull(accountTokens.usedAt))
      );
    await tx.insert(accountTokens).values({
      userId: params.userId,
      purpose: params.purpose,
      tokenHash,
      expiresAt: accountTokenExpiry(params.purpose, now),
      requestedIp: trimIp(params.ip),
    });
  });
  return token;
}

/**
 * Estado do token SEM consumir (a página confere antes de mostrar o
 * formulário) e o dono dele. Conta desativada = link inválido.
 */
export async function findAccountToken(
  db: Database,
  token: string,
  purpose: AccountTokenPurpose
): Promise<{ state: AccountTokenState; user?: AccountUser }> {
  const [row] = await db
    .select({
      expiresAt: accountTokens.expiresAt,
      usedAt: accountTokens.usedAt,
      userId: users.id,
      email: users.email,
      name: users.name,
      active: users.active,
    })
    .from(accountTokens)
    .innerJoin(users, eq(users.id, accountTokens.userId))
    .where(and(eq(accountTokens.tokenHash, hashAccountToken(token)), eq(accountTokens.purpose, purpose)))
    .limit(1);
  if (!row?.email || !row.active) return { state: "invalid" };
  const state = evaluateAccountToken(row);
  return state === "valid" ? { state, user: { id: row.userId, email: row.email, name: row.name } } : { state };
}

/**
 * Consome o token de forma ATÔMICA — um UPDATE condicional (não usado, não
 * vencido): dois cliques simultâneos no mesmo link não passam os dois.
 */
async function consumeAccountToken(
  tx: Transaction,
  token: string,
  purpose: AccountTokenPurpose
): Promise<{ userId: string } | { state: TokenFailure }> {
  const tokenHash = hashAccountToken(token);
  const now = new Date();
  const [consumed] = await tx
    .update(accountTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(accountTokens.tokenHash, tokenHash),
        eq(accountTokens.purpose, purpose),
        isNull(accountTokens.usedAt),
        gt(accountTokens.expiresAt, now)
      )
    )
    .returning({ userId: accountTokens.userId });
  if (consumed) return { userId: consumed.userId };

  const [row] = await tx
    .select({ expiresAt: accountTokens.expiresAt, usedAt: accountTokens.usedAt })
    .from(accountTokens)
    .where(and(eq(accountTokens.tokenHash, tokenHash), eq(accountTokens.purpose, purpose)))
    .limit(1);
  const state = evaluateAccountToken(row, now);
  return { state: state === "valid" ? "invalid" : state };
}

/** Desfecho da confirmação para o cadastro de representante. */
export type VerificationOutcome = {
  /** O pré-cadastro entrou agora na fila de análise. */
  submitted: boolean;
  /** Outro cadastro com o mesmo CNPJ já está na fila ou aprovado: este não entrou. */
  cnpjConflict: boolean;
};

const NOT_PROMOTED: VerificationOutcome = { submitted: false, cnpjConflict: false };

/**
 * E-mail comprovado: grava a data e manda o pré-cadastro do site para a fila de
 * análise. Só promove quando a confirmação acontece AGORA (e-mail que já estava
 * confirmado não mexe em cadastro nenhum) e só o pré-cadastro do SITE —
 * rascunho com `onboardingStep = 0`, com os dados que o próprio pré-cadastro
 * validou; o rascunho do wizard (`onboardingStep ≥ 1`) só vai à fila pelo
 * botão de envio dele. Revisão de segurança 2026-09-30 (B5).
 */
async function applyEmailVerified(tx: Transaction, userId: string): Promise<VerificationOutcome> {
  const now = new Date();
  const verified = await tx
    .update(users)
    .set({ emailVerified: now })
    .where(and(eq(users.id, userId), isNull(users.emailVerified)))
    .returning({ id: users.id });
  if (verified.length === 0) return NOT_PROMOTED;

  const [draft] = await tx
    .select({
      id: representatives.id,
      cnpj: representatives.cnpj,
      companyName: representatives.companyName,
      phone: representatives.phone,
    })
    .from(representatives)
    .where(
      and(
        eq(representatives.userId, userId),
        eq(representatives.status, "draft"),
        isNull(representatives.submittedAt),
        eq(representatives.onboardingStep, 0)
      )
    )
    .limit(1);
  if (
    !draft?.cnpj ||
    !isValidCNPJ(draft.cnpj) ||
    !draft.companyName?.trim() ||
    !draft.phone ||
    !isValidPhoneBR(draft.phone)
  ) {
    return NOT_PROMOTED;
  }

  // Vários pré-cadastros NÃO confirmados podem usar o mesmo CNPJ (nenhum
  // apaga o outro); o primeiro que confirma entra na fila. Os seguintes ficam
  // com o e-mail confirmado, mas fora da fila — o time ROCO resolve.
  const [conflict] = await tx
    .select({ id: representatives.id })
    .from(representatives)
    .where(
      and(
        eq(representatives.cnpj, draft.cnpj),
        ne(representatives.id, draft.id),
        inArray(representatives.status, ["submitted", "approved"])
      )
    )
    .limit(1);
  if (conflict) return { submitted: false, cnpjConflict: true };

  const promoted = await tx
    .update(representatives)
    .set({ status: "submitted", submittedAt: now, updatedAt: now })
    .where(and(eq(representatives.id, draft.id), eq(representatives.status, "draft"), isNull(representatives.submittedAt)))
    .returning({ id: representatives.id });
  return { submitted: promoted.length > 0, cnpjConflict: false };
}

async function isActiveUser(tx: Transaction, userId: string): Promise<boolean> {
  const [user] = await tx.select({ active: users.active }).from(users).where(eq(users.id, userId)).limit(1);
  return user?.active === true;
}

/** Clique em "Confirmar e-mail". `submitted` = o pré-cadastro entrou na fila agora. */
export async function confirmEmail(
  db: Database,
  params: { token: string; ip?: string | null }
): Promise<({ status: "ok" } & VerificationOutcome) | { status: TokenFailure }> {
  return db.transaction(async (tx) => {
    const consumed = await consumeAccountToken(tx, params.token, "email_verification");
    if ("state" in consumed) return { status: consumed.state };
    if (!(await isActiveUser(tx, consumed.userId))) return { status: "invalid" as const };

    const outcome = await applyEmailVerified(tx, consumed.userId);
    await tx.insert(auditLogs).values({
      userId: consumed.userId,
      action: "account.email_verified",
      resource: "users",
      resourceId: consumed.userId,
      metadata: { submittedForReview: outcome.submitted, cnpjConflict: outcome.cnpjConflict },
      ip: trimIp(params.ip),
    });
    return { status: "ok" as const, ...outcome };
  });
}

/**
 * Nova senha pelo link de redefinição (a política já foi conferida pela rota).
 * Na mesma transação: consome o link, troca o hash, marca `passwordChangedAt`
 * (derruba as sessões antigas na revalidação do JWT), invalida outros links
 * de redefinição pendentes e — como o dono provou o e-mail — confirma o
 * e-mail se ainda não estava.
 */
export async function resetPassword(
  db: Database,
  params: { token: string; password: string; ip?: string | null }
): Promise<{ status: "ok"; user: AccountUser } | { status: TokenFailure }> {
  const passwordHash = await bcrypt.hash(params.password, PASSWORD_BCRYPT_COST);
  return db.transaction(async (tx) => {
    const consumed = await consumeAccountToken(tx, params.token, "password_reset");
    if ("state" in consumed) return { status: consumed.state };

    const now = new Date();
    const [user] = await tx
      .update(users)
      .set({ passwordHash, passwordChangedAt: now })
      .where(and(eq(users.id, consumed.userId), eq(users.active, true)))
      .returning({ id: users.id, email: users.email, name: users.name });
    if (!user?.email) return { status: "invalid" as const };

    await tx
      .update(accountTokens)
      .set({ usedAt: now })
      .where(
        and(eq(accountTokens.userId, user.id), eq(accountTokens.purpose, "password_reset"), isNull(accountTokens.usedAt))
      );
    const outcome = await applyEmailVerified(tx, user.id);
    await tx.insert(auditLogs).values({
      userId: user.id,
      action: "account.password_reset",
      resource: "users",
      resourceId: user.id,
      metadata: { submittedForReview: outcome.submitted, cnpjConflict: outcome.cnpjConflict },
      ip: trimIp(params.ip),
    });
    return { status: "ok" as const, user: { id: user.id, email: user.email, name: user.name } };
  });
}

async function sendAccountEmail(
  kind: AccountEmailKind,
  params: { user: AccountUser; locale: Locale; page: AccountPage; token?: string }
): Promise<MailResult> {
  const baseUrl = getAppBaseUrl();
  if (!baseUrl) {
    console.error("[account] AUTH_URL e NEXT_PUBLIC_SITE_URL ausentes — o link do e-mail não pode ser montado.");
    return { status: "not_configured" };
  }
  const dictionary = await getDictionary(params.locale);
  const email = buildAccountEmail(kind, dictionary.emails, {
    name: params.user.name,
    link: accountPageLink(baseUrl, params.locale, params.page, params.token),
    locale: params.locale,
  });
  return sendMail({ to: params.user.email, ...email });
}

/** Link de confirmação de cadastro (24 h). */
export async function sendVerificationEmail(
  db: Database,
  params: { user: AccountUser; locale: Locale; ip?: string | null }
): Promise<MailResult> {
  const token = await issueAccountToken(db, { userId: params.user.id, purpose: "email_verification", ip: params.ip });
  return sendAccountEmail("verifyEmail", { user: params.user, locale: params.locale, page: "confirmar-email", token });
}

/** Link de redefinição de senha (60 min). */
export async function sendPasswordResetEmail(
  db: Database,
  params: { user: AccountUser; locale: Locale; ip?: string | null }
): Promise<MailResult> {
  const token = await issueAccountToken(db, { userId: params.user.id, purpose: "password_reset", ip: params.ip });
  return sendAccountEmail("resetPassword", { user: params.user, locale: params.locale, page: "redefinir-senha", token });
}

/** Aviso de senha alterada — com o caminho para redefinir de novo se não foi a própria pessoa. */
export async function sendPasswordChangedEmail(params: { user: AccountUser; locale: Locale }): Promise<MailResult> {
  return sendAccountEmail("passwordChanged", { user: params.user, locale: params.locale, page: "esqueci-senha" });
}

/** Pré-cadastro do site nunca confirmado é apagado depois disto (LGPD: sem guardar dado de quem não concluiu). */
export const ABANDONED_PRE_REGISTRATION_DAYS = 7;
/** Link de conta usado ou vencido é apagado depois disto. */
export const ACCOUNT_TOKEN_RETENTION_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Limpeza feita a cada novo pré-cadastro (sem job agendado): apaga as contas
 * de pré-cadastros do site que nunca confirmaram o e-mail depois de
 * `ABANDONED_PRE_REGISTRATION_DAYS` — nunca entraram no portal (o login exige o
 * e-mail confirmado), então só guardam o próprio formulário — e os links de
 * conta usados ou vencidos há mais de `ACCOUNT_TOKEN_RETENTION_DAYS`. As condições são
 * as mesmas de `isUnconfirmedPreRegistration`: e-mail não confirmado, só senha,
 * sem login social, sem perfil, rascunho do site nunca enviado. Apagar o
 * `user` leva o rascunho e os links (cascade); a auditoria fica, sem o vínculo.
 */
export async function purgeStaleAccountData(
  db: Database,
  now: Date = new Date()
): Promise<{ accounts: number; tokens: number }> {
  const abandonedBefore = new Date(now.getTime() - ABANDONED_PRE_REGISTRATION_DAYS * DAY_MS);
  const tokensBefore = new Date(now.getTime() - ACCOUNT_TOKEN_RETENTION_DAYS * DAY_MS);

  const removedAccounts = await db
    .delete(users)
    .where(
      and(
        isNull(users.emailVerified),
        isNotNull(users.passwordHash),
        sql`not exists (select 1 from ${accounts} where ${accounts.userId} = ${users.id})`,
        sql`not exists (select 1 from ${userRoles} where ${userRoles.userId} = ${users.id})`,
        sql`exists (select 1 from ${representatives} where ${representatives.userId} = ${users.id} and ${representatives.status} = 'draft' and ${representatives.submittedAt} is null and ${representatives.onboardingStep} = 0 and ${representatives.createdAt} < ${abandonedBefore})`
      )
    )
    .returning({ id: users.id });

  const removedTokens = await db
    .delete(accountTokens)
    .where(
      and(lt(accountTokens.createdAt, tokensBefore), or(isNotNull(accountTokens.usedAt), lt(accountTokens.expiresAt, now)))
    )
    .returning({ id: accountTokens.id });

  return { accounts: removedAccounts.length, tokens: removedTokens.length };
}
