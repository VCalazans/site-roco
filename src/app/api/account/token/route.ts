import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { enforceAccountLimits, ipLimitKey, jsonError, readJsonBody } from "@/server/lib/account-route";
import { findAccountToken } from "@/server/lib/account-service";
import { isWellFormedAccountToken, type AccountTokenPurpose } from "@/server/lib/account-tokens";

const PURPOSES: readonly AccountTokenPurpose[] = ["email_verification", "password_reset"];

/**
 * `POST /api/account/token` `{ token, purpose }` → `{ state }` — confere um
 * link SEM consumi-lo, para a página mostrar "link vencido" antes de a pessoa
 * digitar a nova senha. Não devolve nada sobre a conta.
 */
export async function POST(request: NextRequest) {
  const limited = await enforceAccountLimits([{ key: ipLimitKey("account:token", request), windowSeconds: 15 * 60, max: 60 }]);
  if (limited) return limited;

  const body = await readJsonBody(request);
  const purpose = body?.purpose as AccountTokenPurpose;
  if (!body || !PURPOSES.includes(purpose)) return jsonError("validation", 400);
  if (!isWellFormedAccountToken(body.token)) return NextResponse.json({ state: "invalid" });

  const { state } = await findAccountToken(db, body.token, purpose);
  return NextResponse.json({ state });
}
