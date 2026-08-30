/**
 * Decisão de subir (ou não) os workers BullMQ in-process.
 *
 * Módulo separado e sem `server-only` de propósito: é lógica pura, então
 * dá para testar a decisão sem carregar o BullMQ nem abrir conexão.
 */

/** Por que os workers não subiram — cada motivo tem log próprio. */
export type WorkerStartupDecision =
  | { start: true; redisUrl: string }
  /** Operador desligou explicitamente via `WORKERS_ENABLED=false`. */
  | { start: false; reason: "disabled-by-flag" }
  /** Sem `REDIS_URL` não há fila para consumir (dev local, build). */
  | { start: false; reason: "missing-redis-url" };

/**
 * `WORKERS_ENABLED` desliga os workers SOMENTE quando vale exatamente
 * `"false"` (ignorando espaços em volta e caixa). Qualquer outro valor —
 * inclusive ausente, vazio ou `"0"` — mantém LIGADO.
 *
 * O default é ligado de propósito: nenhum ambiente existente muda de
 * comportamento por omissão desta variável. Só quem escreve `false`
 * explicitamente desliga.
 */
export function isWorkersFlagDisabled(rawFlag: string | undefined): boolean {
  return rawFlag?.trim().toLowerCase() === "false";
}

/**
 * Resolve o que fazer no boot a partir das duas variáveis.
 *
 * A flag é avaliada ANTES do Redis: quando o operador desligou os workers
 * de propósito, esse é o motivo relevante no log — não faz sentido
 * reclamar de `REDIS_URL` ausente numa réplica que nem deveria consumir
 * fila.
 *
 * Por que a flag existe, já que "não definir REDIS_URL" também não sobe
 * worker: `REDIS_URL` faz MUITO mais coisa do que a fila. Sem ela, o
 * rate limit fica sem backend e os dois limites de `POST /api/contact`
 * (ambos `productionSafe: true`, fail-closed) passam a responder 503 —
 * ou seja, "desligar o worker" tirando o Redis desligaria junto a
 * captação de leads do site. Esta flag separa as duas coisas.
 *
 * Para que serve, então: ISOLAR CPU. Hoje cada réplica roda
 * `instrumentation.ts` e sobe o SEU próprio worker `erp-sync`, que processa
 * o sync no MESMO event loop que renderiza página — e o gargalo medido deste
 * sistema é exatamente CPU de event loop. A flag permite deixar as réplicas
 * que servem HTTP sem worker e rodar o worker num processo/container só dele.
 *
 * O que NÃO é motivo para desligar: "vários workers duplicariam job". Não
 * duplicam — o BullMQ entrega cada job a um único worker (reivindicação
 * atômica no Redis), e aqui ainda há o `jobId` por minuto (`job-id.ts`)
 * deduplicando na entrada. Vários consumidores na mesma fila é o modo normal
 * e seguro de operar.
 *
 * ⚠️ QUEM DESLIGA PRECISA GARANTIR UM CONSUMIDOR EM ALGUM LUGAR: o produtor
 * (`POST /api/webhooks/erp`) continua enfileirando e respondendo 202 mesmo
 * sem worker nenhum no ar. Ver `getWorkerRuntimeState` em
 * `register-workers.ts`, publicado no ramo autenticado de `/api/health`.
 */
export function resolveWorkerStartup(env: {
  redisUrl: string | undefined;
  workersEnabled: string | undefined;
}): WorkerStartupDecision {
  if (isWorkersFlagDisabled(env.workersEnabled)) {
    return { start: false, reason: "disabled-by-flag" };
  }

  const redisUrl = env.redisUrl?.trim();
  if (!redisUrl) {
    return { start: false, reason: "missing-redis-url" };
  }

  return { start: true, redisUrl };
}
