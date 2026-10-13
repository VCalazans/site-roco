import "server-only";
import {
  CAPTCHA_ERROR,
  CAPTCHA_UNAVAILABLE_ERROR,
  getTurnstileSiteKey,
  TURNSTILE_TOKEN_FIELD,
  TURNSTILE_TOKEN_MAX_LENGTH,
  type TurnstileAction,
} from "@/shared/lib/turnstile";

/**
 * Validação do token do Cloudflare Turnstile (verificação anti-robô dos
 * formulários públicos e do login do portal). O widget no navegador só EMITE
 * um token; quem decide é esta chamada ao siteverify, feita com o segredo
 * (`TURNSTILE_SECRET_KEY`), que nunca sai do servidor.
 *
 * Regras:
 * - Sem `TURNSTILE_SECRET_KEY`: a verificação é PULADA (`skipped`) — dev e
 *   homologação sem chave seguem funcionando; em produção, um aviso no log
 *   (uma vez por processo).
 * - Com o segredo: token obrigatório. Ausente → `missing`; recusado pela
 *   Cloudflare (ou de outra ação) → `invalid`; sem resposta confiável
 *   (rede, timeout, 5xx, resposta estranha, segredo recusado) → `unavailable`.
 *   As três recusam o envio (fail-closed): a rota responde `captcha` (400) ou
 *   `captcha_unavailable` (503) — ver `turnstileRejection`.
 * - O token é de USO ÚNICO e vale 5 min: cada envio gasta o seu, e o
 *   formulário reseta o widget depois de toda tentativa.
 */

/** Endpoint de validação. Chamado só daqui — ele leva o segredo. */
export const TURNSTILE_SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Teto da chamada ao siteverify. O visitante está esperando a resposta do
 * formulário (e o login, a tela): sem teto, uma Cloudflare lenta prenderia a
 * requisição indefinidamente. Estourou → `unavailable` (recusa, "tente de novo").
 */
export const TURNSTILE_VERIFY_TIMEOUT_MS = 5_000;

export type TurnstileFailureCode = "missing" | "invalid" | "unavailable";

export type TurnstileVerification =
  | { ok: true; skipped?: true }
  | { ok: false; code: TurnstileFailureCode };

export type VerifyTurnstileInput = {
  /** Token do corpo/`FormData` — `unknown` de propósito: é entrada do cliente. */
  token: unknown;
  /** Ação do formulário; um token de outra ação é recusado. */
  action: TurnstileAction;
  /** IP do visitante (`getClientIp`); `"unknown"`/vazio não é enviado. */
  remoteIp?: string | null;
};

/** Leitura da resposta do siteverify, com o motivo da recusa (só para o log). */
export type SiteverifyOutcome =
  | { ok: true }
  | { ok: false; code: "invalid" | "unavailable"; reason: string };

/**
 * Códigos do siteverify que NÃO dizem nada sobre o visitante: segredo
 * ausente/errado (configuração nossa) ou falha interna da Cloudflare. O envio
 * é recusado do mesmo jeito, mas como `unavailable` — "tente de novo", não
 * "você parece um robô".
 */
const SERVER_SIDE_ERROR_CODES = new Set(["missing-input-secret", "invalid-input-secret", "internal-error"]);

/** Códigos de erro da resposta, só os textos plausíveis (vão para o log). */
function errorCodesOf(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((code): code is string => typeof code === "string" && /^[\w-]{1,64}$/.test(code))
    .slice(0, 5);
}

/**
 * Interpreta o JSON do siteverify (pura — testável sem rede).
 *
 * Aprovado = `success === true` e, quando a resposta traz `action` não vazio,
 * igual à esperada. A ação vazia é aceita porque as chaves de TESTE da
 * Cloudflare respondem sem ação; com as chaves reais ela sempre vem.
 * Qualquer coisa fora do formato (sem `success` booleano) é `unavailable`:
 * não dá para afirmar que o visitante é um robô com uma resposta que não
 * entendemos — mas também não dá para deixar passar.
 */
export function interpretSiteverifyResponse(payload: unknown, expectedAction: TurnstileAction): SiteverifyOutcome {
  if (payload === null || typeof payload !== "object" || typeof (payload as { success?: unknown }).success !== "boolean") {
    return { ok: false, code: "unavailable", reason: "malformed-response" };
  }

  const data = payload as { success: boolean; action?: unknown; "error-codes"?: unknown };
  if (data.success) {
    const action = typeof data.action === "string" ? data.action : "";
    if (action !== "" && action !== expectedAction) {
      return { ok: false, code: "invalid", reason: "action-mismatch" };
    }
    return { ok: true };
  }

  const errorCodes = errorCodesOf(data["error-codes"]);
  const serverSide = errorCodes.some((code) => SERVER_SIDE_ERROR_CODES.has(code));
  return { ok: false, code: serverSide ? "unavailable" : "invalid", reason: errorCodes.join(",") || "rejected" };
}

/** Token que o formulário mandou no corpo JSON (`turnstileToken`), sem confiar no tipo. */
export function turnstileTokenFrom(body: unknown): unknown {
  return body !== null && typeof body === "object" ? (body as Record<string, unknown>)[TURNSTILE_TOKEN_FIELD] : undefined;
}

/**
 * Resposta das rotas para uma recusa: `captcha` (400 — refaça a verificação)
 * ou `captcha_unavailable` (503 — falha do lado de cá/da Cloudflare). Nas
 * rotas de conta ela vem ANTES de qualquer consulta, então não diz nada sobre
 * a conta existir.
 */
export function turnstileRejection(code: TurnstileFailureCode) {
  return code === "unavailable"
    ? ({ error: CAPTCHA_UNAVAILABLE_ERROR, status: 503 } as const)
    : ({ error: CAPTCHA_ERROR, status: 400 } as const);
}

// ---------------------------------------------------------------------------
// Log: avisos de configuração uma vez por processo; recusas no máximo uma vez
// por minuto por tipo (um robô insistente não pode usar o log como canal de
// flood). Nunca registra o token nem o IP.

const REJECTION_LOG_INTERVAL_MS = 60_000;

declare global {
  var __rocoTurnstileWarned: { missingSecret?: boolean; missingSiteKey?: boolean } | undefined;
  var __rocoTurnstileLog: Map<string, { lastAt: number; suppressed: number }> | undefined;
}

function warnOnce(flag: "missingSecret" | "missingSiteKey", log: () => void): void {
  const warned = (globalThis.__rocoTurnstileWarned ??= {});
  if (warned[flag]) return;
  warned[flag] = true;
  log();
}

function logRejection(level: "warn" | "error", key: string, message: string): void {
  const states = (globalThis.__rocoTurnstileLog ??= new Map());
  const now = Date.now();
  const state = states.get(key);
  if (state && now - state.lastAt < REJECTION_LOG_INTERVAL_MS) {
    state.suppressed += 1;
    return;
  }
  const suppressed = state?.suppressed ?? 0;
  states.set(key, { lastAt: now, suppressed: 0 });
  console[level](`[turnstile] ${message}${suppressed > 0 ? ` (+${suppressed} parecida(s) no último minuto)` : ""}`);
}

/**
 * Valida o token no siteverify. Nunca lança: qualquer falha vira um código.
 * Ver as regras no topo do arquivo.
 */
export async function verifyTurnstile({ token, action, remoteIp }: VerifyTurnstileInput): Promise<TurnstileVerification> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      warnOnce("missingSecret", () =>
        console.warn(
          "[turnstile] TURNSTILE_SECRET_KEY não configurada — verificação anti-robô DESLIGADA: formulários " +
            "públicos e login aceitam envios sem token. Configure a chave (e NEXT_PUBLIC_TURNSTILE_SITE_KEY no build)."
        )
      );
    }
    return { ok: true, skipped: true };
  }

  // A site key é embutida no build: segredo sem site key = widget que nunca
  // aparece e TODO envio recusado. Configuração errada, não ataque — avisa alto.
  if (!getTurnstileSiteKey()) {
    warnOnce("missingSiteKey", () =>
      console.error(
        "[turnstile] TURNSTILE_SECRET_KEY configurada, mas o build não tem NEXT_PUBLIC_TURNSTILE_SITE_KEY: o widget " +
          "não aparece nos formulários e todo envio será recusado. Refaça o build com a site key."
      )
    );
  }

  if (typeof token !== "string" || token.trim() === "") {
    logRejection("warn", `missing:${action}`, `Envio sem token (ação ${action}) — recusado.`);
    return { ok: false, code: "missing" };
  }
  if (token.length > TURNSTILE_TOKEN_MAX_LENGTH) {
    logRejection("warn", `invalid:${action}`, `Token acima de ${TURNSTILE_TOKEN_MAX_LENGTH} caracteres (ação ${action}) — recusado.`);
    return { ok: false, code: "invalid" };
  }

  const params = new URLSearchParams({ secret, response: token, idempotency_key: crypto.randomUUID() });
  if (remoteIp && remoteIp !== "unknown") params.set("remoteip", remoteIp);

  let response: Response;
  try {
    response = await fetch(TURNSTILE_SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      signal: AbortSignal.timeout(TURNSTILE_VERIFY_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    logRejection("error", `unavailable:${action}`, `Siteverify sem resposta (ação ${action}): ${timedOut ? "timeout" : "falha de rede"} — envio recusado.`);
    return { ok: false, code: "unavailable" };
  }

  if (response.status >= 500) {
    logRejection("error", `unavailable:${action}`, `Siteverify respondeu HTTP ${response.status} (ação ${action}) — envio recusado.`);
    return { ok: false, code: "unavailable" };
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Corpo que não é JSON (ou leitura abortada pelo timeout): cai em "malformed-response".
  }

  const outcome = interpretSiteverifyResponse(payload, action);
  if (outcome.ok) return { ok: true };

  if (outcome.code === "unavailable") {
    logRejection(
      "error",
      `unavailable:${action}`,
      `Não foi possível validar o token (ação ${action}): ${outcome.reason}` +
        (outcome.reason.includes("secret") ? " — confira TURNSTILE_SECRET_KEY." : ".")
    );
  } else {
    logRejection("warn", `invalid:${action}`, `Token recusado (ação ${action}): ${outcome.reason}.`);
  }
  return { ok: false, code: outcome.code };
}
