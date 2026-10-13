import { after, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { emailRateLimitKey } from "@/server/lib/account-tokens";
import { enforceAccountLimits, ipLimitKey, jsonError, jsonOk, readJsonBody, requestLocale } from "@/server/lib/account-route";
import { findActiveUserByEmail, sendPasswordResetEmail } from "@/server/lib/account-service";
import { getClientIp } from "@/server/lib/rate-limit";
import { turnstileRejection, turnstileTokenFrom, verifyTurnstile } from "@/server/lib/turnstile";
import { TURNSTILE_ACTIONS } from "@/shared/lib/turnstile";

const emailSchema = z.string().trim().toLowerCase().email().max(320);

/**
 * `POST /api/account/password/forgot` `{ email, locale, turnstileToken }` — "Esqueci minha senha".
 *
 * Resposta SEMPRE a mesma (`{ ok: true }`), exista ou não a conta, e o envio
 * roda depois da resposta (`after`): nem o conteúdo nem o tempo de resposta
 * dizem se o e-mail tem conta. Pedir de novo invalida o link anterior.
 *
 * Verificação anti-robô (Turnstile, ação `senha`) logo depois de ler o corpo e
 * ANTES do schema e de qualquer consulta: a recusa (`captcha`) também não
 * depende de a conta existir.
 */
export async function POST(request: NextRequest) {
  // Limite por IP ANTES de ler o corpo: requisição de lixo também gasta a cota de quem a manda.
  const byIp = await enforceAccountLimits([{ key: ipLimitKey("account:forgot", request), windowSeconds: 15 * 60, max: 10 }]);
  if (byIp) return byIp;

  const body = await readJsonBody(request);
  if (!body) return jsonError("validation", 400);

  const ip = getClientIp(request);
  const captcha = await verifyTurnstile({
    token: turnstileTokenFrom(body),
    action: TURNSTILE_ACTIONS.passwordReset,
    remoteIp: ip,
  });
  if (!captcha.ok) {
    const rejection = turnstileRejection(captcha.code);
    return jsonError(rejection.error, rejection.status);
  }

  const email = emailSchema.safeParse(body.email);
  if (!email.success) return jsonError("validation", 400);

  const byEmail = await enforceAccountLimits([
    { key: emailRateLimitKey("account:forgot", email.data), windowSeconds: 60 * 60, max: 3 },
  ]);
  if (byEmail) return byEmail;

  const locale = requestLocale(body.locale);
  after(async () => {
    const user = await findActiveUserByEmail(db, email.data);
    if (!user) return;
    await sendPasswordResetEmail(db, { user, locale, ip });
  });
  return jsonOk();
}
