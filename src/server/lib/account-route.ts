import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, locales, type Locale } from "@/i18n/config";
import { checkRateLimit, getClientIp, normalizeRateLimitKeyPart } from "./rate-limit";
import { checkContentLength, readBodyTextWithLimit } from "./request-size";

/**
 * Peças comuns das rotas públicas de conta (`/api/account/*`) e do pré-cadastro.
 */

/** Teto do corpo destas rotas: os campos (e-mail, senha, nome…) cabem em poucas centenas de bytes. */
export const ACCOUNT_BODY_MAX_BYTES = 16 * 1024;

/**
 * Corpo JSON da requisição, ou `null` (a rota responde 400). Só aceita
 * `Content-Type: application/json` — um `<form>` de outro site não consegue
 * enviar isso sem passar pelo CORS, então a rota não é alvo de CSRF por
 * formulário simples — e lê no máximo `ACCOUNT_BODY_MAX_BYTES`, contando os
 * bytes (o `request.json()` do Route Handler bufferizaria qualquer tamanho).
 */
export async function readJsonBody(request: NextRequest): Promise<Record<string, unknown> | null> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return null;
  const declared = checkContentLength(request.headers.get("content-length"), ACCOUNT_BODY_MAX_BYTES);
  if (declared.kind === "too-large" || declared.kind === "malformed") return null;
  const body = await readBodyTextWithLimit(request, ACCOUNT_BODY_MAX_BYTES);
  if (!body.ok) return null;
  try {
    const parsed: unknown = JSON.parse(body.text);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Idioma dos e-mails: o da página de onde veio o pedido (padrão pt). */
export function requestLocale(value: unknown): Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value) ? (value as Locale) : defaultLocale;
}

export function ipLimitKey(scope: string, request: NextRequest): string {
  return `${scope}:ip:${normalizeRateLimitKeyPart(getClientIp(request))}`;
}

export type AccountLimit = { key: string; windowSeconds: number; max: number };

/**
 * Aplica os limites — todos FAIL-CLOSED (`productionSafe`): rota de conta sem
 * limitador é convite a força bruta e a disparo de e-mail em massa. Devolve a
 * resposta de erro (429 limite estourado; 503 limitador fora do ar) ou `null`.
 */
export async function enforceAccountLimits(limits: AccountLimit[]): Promise<NextResponse | null> {
  const results = await Promise.all(
    limits.map(({ key, windowSeconds, max }) => checkRateLimit(key, { windowSeconds, max, productionSafe: true }))
  );
  if (results.some((result) => result.unavailable)) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
  const blocked = results.filter((result) => !result.allowed);
  if (blocked.length > 0) {
    const retryAfter = Math.max(...blocked.map((result) => result.retryAfterSeconds));
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
  }
  return null;
}

export const jsonError = (error: string, status: number) => NextResponse.json({ error }, { status });
export const jsonOk = () => NextResponse.json({ ok: true });
