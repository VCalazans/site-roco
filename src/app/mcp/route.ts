import { after, NextResponse, type NextRequest } from "next/server";
import { extractMcpUsageEvents } from "@/modules/ai/lib/ai-usage";
import { countMcpMessages, handleMcpBody, SUPPORTED_PROTOCOL_VERSIONS } from "@/modules/ai/lib/mcp-protocol";
import { describeRocoMcpServer, getRocoMcpServer } from "@/modules/ai/server/mcp-server";
import { recordAiUsage } from "@/server/lib/ai-usage";
import { checkRateLimit, getClientIp } from "@/server/lib/rate-limit";
import { checkContentLength, readBodyTextWithLimit } from "@/server/lib/request-size";

/**
 * Servidor MCP PÚBLICO da ROCO (spec 003) — Streamable HTTP, stateless, JSON.
 *
 * - `POST /mcp`: JSON-RPC 2.0 (mensagem única ou lote de até 10) →
 *   `initialize`, `ping`, `tools/list`, `tools/call`. Só leitura do catálogo
 *   público (ver `@/modules/ai/lib/mcp-tools`).
 * - `GET /mcp`: com `Accept: text/event-stream` → 405 (sem SSE neste servidor);
 *   sem isso, a descrição em JSON para humanos e robôs.
 * - `DELETE` → 405 (não há sessão para encerrar).
 *
 * Proteções: corpo até 64 KiB; limites por IP e global contados por MENSAGEM
 * do lote (Redis; FAIL-OPEN de propósito —
 * é leitura pública, e o catálogo continua no site de qualquer jeito), CORS
 * aberto SEM credenciais (nenhum cookie é lido aqui), sem Turnstile (agente não
 * resolve desafio). Fica fora do `src/proxy.ts` (matcher exclui `mcp`).
 *
 * Uso: cada `initialize` (por IA) e cada `tools/call` (por ferramenta) soma um
 * contador diário em `ai_usage_daily` — sem IP nem identificador de pessoa.
 */
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 64 * 1024;
/** Mensagens JSON-RPC por minuto, por IP e no total (o CORS aberto deixa qualquer página distribuir chamadas). */
const MCP_IP_RATE_LIMIT = { windowSeconds: 60, max: 120 };
const MCP_GLOBAL_RATE_LIMIT = { windowSeconds: 60, max: 1500 };

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID",
  "Access-Control-Max-Age": "86400",
};

const BASE_HEADERS = {
  ...CORS_HEADERS,
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex",
};

function json(body: unknown, status: number, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...BASE_HEADERS, ...extra } });
}

function rpcError(status: number, code: number, message: string, extra: Record<string, string> = {}) {
  return json({ jsonrpc: "2.0", id: null, error: { code, message } }, status, extra);
}

export async function POST(request: NextRequest) {
  const declared = checkContentLength(request.headers.get("content-length"), MAX_BODY_BYTES);
  if (declared.kind === "malformed") return rpcError(400, -32600, "Invalid Content-Length");
  if (declared.kind === "too-large") return rpcError(413, -32600, "Request body too large");

  const body = await readBodyTextWithLimit(request, MAX_BODY_BYTES);
  if (!body.ok) return rpcError(413, -32600, "Request body too large");

  // Limites DEPOIS de ler o corpo (≤ 64 KiB) para cobrar por mensagem do lote.
  const cost = countMcpMessages(body.text);
  const ip = getClientIp(request);
  for (const [key, limit] of [
    [`mcp:ip:${ip}`, MCP_IP_RATE_LIMIT],
    ["mcp:global", MCP_GLOBAL_RATE_LIMIT],
  ] as const) {
    const rateLimit = await checkRateLimit(key, { ...limit, cost });
    if (!rateLimit.allowed) {
      return rpcError(429, -32000, "Too many requests", { "Retry-After": String(rateLimit.retryAfterSeconds) });
    }
  }

  const requestedVersion = request.headers.get("mcp-protocol-version");
  if (requestedVersion && !(SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requestedVersion)) {
    return rpcError(400, -32600, `Unsupported MCP-Protocol-Version: ${requestedVersion.slice(0, 20)}`);
  }

  const result = await handleMcpBody(body.text, await getRocoMcpServer());
  // Métrica de uso (painel "Uso da IA"): só contadores, fora do caminho da resposta.
  after(() => recordAiUsage(extractMcpUsageEvents(body.text, result.body)));
  if (!result.body) {
    return new NextResponse(null, { status: result.status, headers: BASE_HEADERS });
  }
  return json(result.body, result.status);
}

export async function GET(request: NextRequest) {
  if ((request.headers.get("accept") ?? "").includes("text/event-stream")) {
    return new NextResponse(null, { status: 405, headers: { ...BASE_HEADERS, Allow: "GET, POST, OPTIONS" } });
  }
  return json(await describeRocoMcpServer(), 200, { "Cache-Control": "public, max-age=3600" });
}

export function DELETE() {
  return new NextResponse(null, { status: 405, headers: { ...BASE_HEADERS, Allow: "GET, POST, OPTIONS" } });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
