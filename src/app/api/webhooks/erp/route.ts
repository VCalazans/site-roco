import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getErpSyncQueue } from "@/core/queue/erp-sync-queue";
import { erpSyncJobId } from "@/core/queue/job-id";
import { checkRateLimit } from "@/server/lib/rate-limit";

const webhookBodySchema = z.object({
  event: z.string().trim().min(1).max(100),
  products: z.array(z.unknown()).optional(),
});

/** Chave única (não por origem) — o ERP é o único chamador esperado deste endpoint. */
const WEBHOOK_RATE_LIMIT = { windowSeconds: 60, max: 60 };

/** Comparação em tempo constante, tolerante a tamanhos diferentes (evita early-return por length). */
function timingSafeEqualString(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) {
    // Ainda compara contra um buffer do mesmo tamanho para não vazar timing pelo length-check.
    timingSafeEqual(bufferA, Buffer.alloc(bufferA.length));
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}

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

    const json = await request.json().catch(() => null);
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
