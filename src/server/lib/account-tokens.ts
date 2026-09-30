import { createHash, randomBytes } from "node:crypto";

/**
 * Tokens dos links de conta enviados por e-mail — puros e testáveis (o acesso
 * ao banco fica em `account-service.ts`).
 *
 * - 32 bytes aleatórios (`crypto.randomBytes`) em base64url: 256 bits, sem
 *   chance de adivinhação por força bruta.
 * - Só o SHA-256 é gravado: o banco nunca guarda um link utilizável.
 * - Validade curta e uso único.
 */
export type AccountTokenPurpose = "email_verification" | "password_reset";

export const ACCOUNT_TOKEN_TTL_MS: Record<AccountTokenPurpose, number> = {
  email_verification: 24 * 60 * 60 * 1000,
  password_reset: 60 * 60 * 1000,
};

const TOKEN_BYTES = 32;
/** base64url de 32 bytes: 43 caracteres, sem padding. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function hashAccountToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateAccountToken(): { token: string; tokenHash: string } {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  return { token, tokenHash: hashAccountToken(token) };
}

/** Filtra lixo antes de ir ao banco (o hash de qualquer string seria só um "não encontrado"). */
export function isWellFormedAccountToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

export function accountTokenExpiry(purpose: AccountTokenPurpose, now = new Date()): Date {
  return new Date(now.getTime() + ACCOUNT_TOKEN_TTL_MS[purpose]);
}

export type AccountTokenState = "valid" | "invalid" | "expired" | "used";

/** Estado de um token lido do banco (`undefined` = não existe). */
export function evaluateAccountToken(
  row: { expiresAt: Date; usedAt: Date | null } | undefined,
  now = new Date()
): AccountTokenState {
  if (!row) return "invalid";
  if (row.usedAt) return "used";
  if (row.expiresAt.getTime() <= now.getTime()) return "expired";
  return "valid";
}

/**
 * Chave de rate limit por e-mail sem o endereço em claro no Redis — só um
 * prefixo do SHA-256 do e-mail normalizado.
 */
export function emailRateLimitKey(scope: string, email: string): string {
  const digest = createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
  return `${scope}:email:${digest.slice(0, 32)}`;
}

/**
 * Caixa de e-mail de destino, sem o sub-endereço: `maria+1@x.com` e
 * `maria+2@x.com` chegam na MESMA caixa, então contam juntos no limite de
 * pré-cadastros por destinatário (senão o formulário viraria disparador de
 * e-mails para uma pessoa só).
 */
export function mailboxOf(email: string): string {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at <= 0) return normalized;
  const local = normalized.slice(0, at).split("+")[0] || normalized.slice(0, at);
  return `${local}${normalized.slice(at)}`;
}

/** Chave de rate limit pela caixa de destino (ver `mailboxOf`), também só com o hash. */
export function mailboxRateLimitKey(scope: string, email: string): string {
  return emailRateLimitKey(scope, mailboxOf(email)).replace(":email:", ":mailbox:");
}
