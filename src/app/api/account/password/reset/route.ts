import { after, NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { enforceAccountLimits, ipLimitKey, jsonError, readJsonBody, requestLocale } from "@/server/lib/account-route";
import { findAccountToken, resetPassword, sendPasswordChangedEmail } from "@/server/lib/account-service";
import { isWellFormedAccountToken } from "@/server/lib/account-tokens";
import { getClientIp } from "@/server/lib/rate-limit";
import { checkPassword } from "@/shared/lib/password-policy";

/**
 * `POST /api/account/password/reset` `{ token, password, locale }` — grava a
 * nova senha do link de redefinição.
 *
 * Confere o link, aplica a política de senha (com o e-mail da conta), troca o
 * hash e derruba as sessões abertas (`passwordChangedAt`). Depois avisa por
 * e-mail que a senha mudou — se não foi a própria pessoa, ela fica sabendo.
 */
export async function POST(request: NextRequest) {
  const limited = await enforceAccountLimits([
    { key: ipLimitKey("account:reset", request), windowSeconds: 15 * 60, max: 20 },
  ]);
  if (limited) return limited;

  const body = await readJsonBody(request);
  if (!body || !isWellFormedAccountToken(body.token)) return jsonError("invalid", 400);
  if (typeof body.password !== "string") return jsonError("validation", 400);

  const token = await findAccountToken(db, body.token, "password_reset");
  if (token.state !== "valid" || !token.user) return jsonError(token.state, 400);

  const issue = checkPassword(body.password, { email: token.user.email });
  if (issue) return NextResponse.json({ error: "weak_password", issue }, { status: 400 });

  const result = await resetPassword(db, { token: body.token, password: body.password, ip: getClientIp(request) });
  if (result.status !== "ok") return jsonError(result.status, 400);

  const locale = requestLocale(body.locale);
  after(() => sendPasswordChangedEmail({ user: result.user, locale }));
  return NextResponse.json({ ok: true });
}
