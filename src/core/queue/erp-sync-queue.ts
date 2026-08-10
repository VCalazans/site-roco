import "server-only";
import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import type { ErpSyncJobData } from "./erp-sync-types";

const QUEUE_NAME = "erp-sync";
const DLQ_NAME = "erp-sync-dlq";

declare global {
  var __rocoErpSyncConnection: IORedis | undefined;
  var __rocoErpSyncQueue: Queue<ErpSyncJobData> | undefined;
  var __rocoErpSyncDlqQueue: Queue | undefined;
  var __rocoErpSyncWorker: Worker<ErpSyncJobData> | undefined;
}

function getConnection(redisUrl: string): IORedis {
  globalThis.__rocoErpSyncConnection ??= new IORedis(redisUrl, {
    // Exigido pelo BullMQ (workers fazem BLPOP-style blocking commands).
    maxRetriesPerRequest: null,
  });
  return globalThis.__rocoErpSyncConnection;
}

/**
 * Fila BullMQ de sincronização de produtos do ERP (idempotência por
 * `jobId` por minuto — ver `job-id.ts` — e por `erpCode`/`sku` no upsert,
 * ver decisionLog 2026-08-09). Só chame depois de confirmar que
 * `REDIS_URL` está definida.
 */
export function getErpSyncQueue(redisUrl: string): Queue<ErpSyncJobData> {
  if (!globalThis.__rocoErpSyncQueue) {
    globalThis.__rocoErpSyncQueue = new Queue<ErpSyncJobData>(QUEUE_NAME, {
      connection: getConnection(redisUrl),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });
  }
  return globalThis.__rocoErpSyncQueue;
}

/** Fila "morta" — recebe uma cópia dos jobs que esgotaram todas as tentativas. */
export function getErpSyncDlqQueue(redisUrl: string): Queue {
  if (!globalThis.__rocoErpSyncDlqQueue) {
    globalThis.__rocoErpSyncDlqQueue = new Queue(DLQ_NAME, {
      connection: getConnection(redisUrl),
      defaultJobOptions: { removeOnComplete: 100, removeOnFail: 1000 },
    });
  }
  return globalThis.__rocoErpSyncDlqQueue;
}

/**
 * Registra o worker in-process do sync ERP (processor real em
 * `erp-sync-processor.ts`). Jobs que esgotam as 3 tentativas são copiados
 * para a fila `erp-sync-dlq` para investigação manual.
 */
export function registerErpSyncWorker(redisUrl: string): Worker<ErpSyncJobData> {
  getErpSyncQueue(redisUrl);

  if (!globalThis.__rocoErpSyncWorker) {
    const worker = new Worker<ErpSyncJobData>(
      QUEUE_NAME,
      async (job: Job<ErpSyncJobData>) => {
        const { processErpSyncJob } = await import("./erp-sync-processor");
        return processErpSyncJob(job.data);
      },
      { connection: getConnection(redisUrl) }
    );

    worker.on("failed", (job, error) => {
      console.error(`[queue:${QUEUE_NAME}] job ${job?.id ?? "?"} falhou.`, error.message);

      if (!job) return;
      const attemptsMade = job.attemptsMade;
      const maxAttempts = typeof job.opts.attempts === "number" ? job.opts.attempts : 1;
      if (attemptsMade < maxAttempts) {
        // Ainda tem retry agendado — não é falha final.
        return;
      }

      void getErpSyncDlqQueue(redisUrl)
        .add("erp-sync-failed", {
          originalJobId: job.id,
          data: job.data,
          error: error.message,
          failedAt: new Date().toISOString(),
        })
        .catch((dlqError: unknown) => {
          console.error(`[queue:${DLQ_NAME}] Falha ao registrar job na DLQ.`, dlqError);
        });
    });

    globalThis.__rocoErpSyncWorker = worker;
  }

  return globalThis.__rocoErpSyncWorker;
}
