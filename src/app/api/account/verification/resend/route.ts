import { after, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { emailRateLimitKey } from "@/server/lib/account-tokens";
import { enforceAccountLimits, ipLimitKey, jsonError, jsonOk, readJsonBody, requestLocale } from "@/server/lib/account-route";
import { findActiveUserByEmail, sendVerificationEmail } from "@/server/lib/account-service";
import { getClientIp } from "@/server/lib/rate-limit";

const emailSchema = z.string().trim().toLowerCase().email().max(320);

/**
 * `POST /api/account/verification/resend` `{ email, locale }` — novo link de
 * confirmação de cadastro.
 *
 * Resposta SEMPRE a mesma (`{ ok: true }`), exista ou não um cadastro
 * pendente com aquele e-mail: a rota não serve para descobrir quem tem conta.
 * O envio roda depois da resposta (`after`), então o tempo de resposta também
 * não entrega a diferença.
 */
export async function POST(request: NextRequest) {
  // Limite por IP ANTES de ler o corpo: requisição de lixo também gasta a cota de quem a manda.
  const byIp = await enforceAccountLimits([
    { key: ipLimitKey("account:verify-resend", request), windowSeconds: 15 * 60, max: 10 },
  ]);
  if (byIp) return byIp;

  const body = await readJsonBody(request);
  const email = emailSchema.safeParse(body?.email);
  if (!body || !email.success) return jsonError("validation", 400);

  const byEmail = await enforceAccountLimits([
    { key: emailRateLimitKey("account:verify-resend", email.data), windowSeconds: 60 * 60, max: 3 },
  ]);
  if (byEmail) return byEmail;

  const locale = requestLocale(body.locale);
  const ip = getClientIp(request);
  after(async () => {
    const user = await findActiveUserByEmail(db, email.data);
    if (!user || user.emailVerified) return;
    await sendVerificationEmail(db, { user, locale, ip });
  });
  return jsonOk();
}
