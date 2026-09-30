import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { enforceAccountLimits, ipLimitKey, jsonError, readJsonBody } from "@/server/lib/account-route";
import { confirmEmail } from "@/server/lib/account-service";
import { isWellFormedAccountToken } from "@/server/lib/account-tokens";
import { getClientIp } from "@/server/lib/rate-limit";

/**
 * `POST /api/account/verification/confirm` `{ token }` — confirma o e-mail do
 * cadastro. É POST (botão na página), nunca GET: leitores de link de antivírus
 * e de clientes de e-mail abrem os links sozinhos e consumiriam o token antes
 * da pessoa.
 *
 * `submitted: true` = o pré-cadastro entrou agora na fila de análise;
 * `cnpjConflict: true` = e-mail confirmado, mas outro cadastro com o mesmo CNPJ
 * já está na fila (ou aprovado) — este não entrou.
 */
export async function POST(request: NextRequest) {
  const limited = await enforceAccountLimits([
    { key: ipLimitKey("account:verify-confirm", request), windowSeconds: 15 * 60, max: 30 },
  ]);
  if (limited) return limited;

  const body = await readJsonBody(request);
  if (!body || !isWellFormedAccountToken(body.token)) return jsonError("invalid", 400);

  const result = await confirmEmail(db, { token: body.token, ip: getClientIp(request) });
  if (result.status !== "ok") return jsonError(result.status, 400);
  return NextResponse.json({ ok: true, submitted: result.submitted, cnpjConflict: result.cnpjConflict });
}
