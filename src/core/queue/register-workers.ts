import "server-only";

declare global {
  var __rocoWorkersStarted: boolean | undefined;
}

/**
 * Inicializa os workers BullMQ do portal (ex.: sync ERP), chamada por
 * `instrumentation.ts`. Sem `REDIS_URL` definida, é um no-op registrado em
 * log — o app precisa continuar funcionando (site público, portal sem sync)
 * mesmo sem Redis disponível.
 */
export function startWorkers(): void {
  if (globalThis.__rocoWorkersStarted) {
    return;
  }
  globalThis.__rocoWorkersStarted = true;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.log("[queue] REDIS_URL não configurada — workers desativados (no-op).");
    return;
  }

  void import("./erp-sync-queue")
    .then(({ registerErpSyncWorker }) => {
      registerErpSyncWorker(redisUrl);
      console.log("[queue] Worker erp-sync registrado.");
    })
    .catch((error: unknown) => {
      console.error("[queue] Falha ao iniciar workers.", error);
    });
}
