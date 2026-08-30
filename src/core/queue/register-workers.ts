import "server-only";
import { resolveWorkerStartup } from "./workers-enabled";

/** Estado do worker neste processo, para `/api/health` responder por ele. */
export type WorkerRuntimeState = {
  /** `true` só quando o worker `erp-sync` foi de fato registrado aqui. */
  running: boolean;
  /**
   * Por que não está rodando. `not-initialized` = `instrumentation.ts` ainda
   * não rodou (ou este processo não é o servidor Node, ex.: durante o build).
   */
  reason: "disabled-by-flag" | "missing-redis-url" | "start-failed" | "not-initialized" | null;
};

declare global {
  var __rocoWorkersStarted: boolean | undefined;
  var __rocoWorkerState: WorkerRuntimeState | undefined;
}

/**
 * Estado observável do worker deste processo.
 *
 * POR QUE ISSO É EXPOSTO EM `/api/health` (no ramo autenticado): desligar o
 * worker por flag cria um modo de falha SILENCIOSO. `POST /api/webhooks/erp`
 * continua enfileirando e respondendo `202 { queued: true }` ao ERP, que
 * registra sucesso em todo envio, enquanto NINGUÉM consome a fila — o
 * catálogo simplesmente para de sincronizar e a única evidência é a ausência
 * de linhas novas em `sync_runs`. Com `REDIS_URL` ausente isso não acontecia
 * porque o webhook falhava alto (503); com a flag, tudo parece verde.
 *
 * O estado vive em `globalThis` porque quem escreve (`instrumentation.ts`) e
 * quem lê (o Route Handler do health) podem estar em bundles diferentes do
 * mesmo processo.
 */
export function getWorkerRuntimeState(): WorkerRuntimeState {
  return globalThis.__rocoWorkerState ?? { running: false, reason: "not-initialized" };
}

/**
 * Inicializa os workers BullMQ do portal (ex.: sync ERP), chamada por
 * `instrumentation.ts`.
 *
 * Dois jeitos de NÃO subir worker, com significados diferentes:
 * - `WORKERS_ENABLED=false` — desligamento deliberado, mantendo o Redis
 *   ligado para o rate limit (ver `workers-enabled.ts`). É o que se usa para
 *   separar o worker num processo/container próprio.
 * - `REDIS_URL` ausente — não há fila (dev local, build). O app precisa
 *   continuar funcionando (site público, portal sem sync) mesmo assim.
 */
export function startWorkers(): void {
  if (globalThis.__rocoWorkersStarted) {
    return;
  }
  globalThis.__rocoWorkersStarted = true;

  const decision = resolveWorkerStartup({
    redisUrl: process.env.REDIS_URL,
    workersEnabled: process.env.WORKERS_ENABLED,
  });

  if (!decision.start) {
    globalThis.__rocoWorkerState = { running: false, reason: decision.reason };

    if (decision.reason === "disabled-by-flag") {
      console.warn(
        "[queue] WORKERS_ENABLED=false — workers desativados por configuração. " +
          "A fila erp-sync NÃO será consumida por este processo (o Redis segue " +
          "em uso para rate limiting). ATENÇÃO: o webhook do ERP continua " +
          "respondendo 202 e enfileirando; se nenhum outro processo estiver " +
          "com o worker ligado, os jobs ficam parados sem erro nenhum."
      );
    } else {
      console.log("[queue] REDIS_URL não configurada — workers desativados (no-op).");
    }
    return;
  }

  const { redisUrl } = decision;

  void import("./erp-sync-queue")
    .then(({ registerErpSyncWorker }) => {
      registerErpSyncWorker(redisUrl);
      globalThis.__rocoWorkerState = { running: true, reason: null };
      console.log("[queue] Worker erp-sync registrado.");
    })
    .catch((error: unknown) => {
      globalThis.__rocoWorkerState = { running: false, reason: "start-failed" };
      console.error("[queue] Falha ao iniciar workers.", error);
    });
}
