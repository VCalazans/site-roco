import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getErpSyncQueue } from "@/core/queue/erp-sync-queue";
import { erpSyncJobId } from "@/core/queue/job-id";
import { checkRateLimit } from "@/server/lib/rate-limit";
import { checkContentLength, readBodyTextWithLimit } from "@/server/lib/request-size";
import { timingSafeEqualString } from "@/server/lib/timing-safe";

const webhookBodySchema = z.object({
  event: z.string().trim().min(1).max(100),
  products: z.array(z.unknown()).optional(),
});

/** Chave única (não por origem) — o ERP é o único chamador esperado deste endpoint. */
const WEBHOOK_RATE_LIMIT = { windowSeconds: 60, max: 60 };

/**
 * Teto do corpo do webhook: 10 MB.
 *
 * Route Handler não tem limite de corpo, e `request.json()` bufferiza tudo
 * antes de qualquer validação — um lote gigante (ou um ERP mal configurado
 * mandando o catálogo inteiro de uma vez) inflaria a memória do processo,
 * que é o MESMO processo que serve o site. 10 MB é folgado para um lote de
 * sync incremental em JSON e ainda assim é um teto.
 *
 * Note que o risco aqui é de ERP mal configurado, não de atacante anônimo:
 * a checagem do segredo compartilhado acontece ANTES desta leitura, então
 * quem não tem o segredo nunca chega a fazer o servidor ler corpo nenhum.
 *
 * NÃO limite o NÚMERO de itens (`products`) para "forçar paginação": o
 * `jobId` da fila é `erp-sync:YYYYMMDDHHMM` (`src/core/queue/job-id.ts`),
 * ou seja, UM job por minuto, global e deliberado (throttle). O BullMQ
 * descarta silenciosamente um job cujo `jobId` já existe — então o ERP
 * paginando dentro do mesmo minuto teria a segunda página e as seguintes
 * DESCARTADAS sem erro. Aqui se protege memória por bytes; o volume por
 * lote é problema do contrato do ERP.
 */
const MAX_WEBHOOK_BODY_BYTES = 10 * 1024 * 1024;

/**
 * Webhook do ERP: enfileira um job `erp-sync` com o payload recebido.
 * Autenticado por segredo compartilhado (header `x-webhook-secret`) — nunca
 * expõe detalhes internos (fila, banco) na resposta.
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimit = await checkRateLimit("webhook:erp", WEBHOOK_RATE_LIMIT);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
      );
    }

    const expectedSecret = process.env.ERP_WEBHOOK_SECRET;
    if (!expectedSecret) {
      console.error("[api/webhooks/erp] ERP_WEBHOOK_SECRET não configurado.");
      return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    const providedSecret = request.headers.get("x-webhook-secret");
    if (!providedSecret || !timingSafeEqualString(providedSecret, expectedSecret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      console.error("[api/webhooks/erp] REDIS_URL não configurado.");
      return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    // Teto de corpo ANTES de qualquer parse. O header é a via barata (recusa
    // sem ler um byte); a leitura contada logo abaixo é a garantia real,
    // válida também quando o header não veio ou mentiu.
    const lengthVerdict = checkContentLength(
      request.headers.get("content-length"),
      MAX_WEBHOOK_BODY_BYTES
    );
    if (lengthVerdict.kind === "too-large") {
      console.warn(
        `[api/webhooks/erp] Corpo recusado por Content-Length: ${lengthVerdict.bytes} bytes ` +
          `(teto ${MAX_WEBHOOK_BODY_BYTES}).`
      );
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
    if (lengthVerdict.kind === "malformed") {
      return NextResponse.json({ error: "Invalid Content-Length" }, { status: 400 });
    }

    const body = await readBodyTextWithLimit(request, MAX_WEBHOOK_BODY_BYTES);
    if (!body.ok) {
      console.warn(
        `[api/webhooks/erp] Corpo recusado durante a leitura: passou do teto de ` +
          `${MAX_WEBHOOK_BODY_BYTES} bytes.`
      );
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    let json: unknown;
    try {
      json = JSON.parse(body.text);
    } catch {
      json = null;
    }

    const parsed = webhookBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const queue = getErpSyncQueue(redisUrl);
    await queue.add(
      "erp-sync",
      { triggeredBy: "webhook", event: parsed.data.event, products: parsed.data.products },
      { jobId: erpSyncJobId() }
    );

    return NextResponse.json({ queued: true }, { status: 202 });
  } catch (error) {
    console.error("[api/webhooks/erp]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
