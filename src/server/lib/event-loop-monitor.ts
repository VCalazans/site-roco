import { monitorEventLoopDelay, type IntervalHistogram } from "node:perf_hooks";
import { summarizeHistogram, type DelaySummary } from "./event-loop-metrics";

/**
 * Monitor de atraso do event loop do processo — a única métrica que revela o
 * modo de falha real deste sistema (LENTIDÃO SEM ERRO).
 *
 * Vive fora do `route.ts` porque tem estado de processo (dois histogramas e
 * um timer) e precisa ser criado UMA vez, não por request.
 *
 * ## Por que DOIS histogramas
 *
 * Um histograma acumulado desde o boot é inútil para detectar um incidente
 * EM CURSO, que é justamente o caso de uso: com `resolution` de 20 ms são
 * ~50 amostras por segundo, ou seja ~4,3 MILHÕES de amostras em 24 h de
 * uptime — o estado normal de um container `restart: unless-stopped`. Um
 * incidente de 5 minutos são ~15 mil amostras: 0,35% do total, longe de
 * mover o p90 (precisa de >10%) ou o p99 (precisa de >1%). Medido com esta
 * mesma classe de histograma, alimentando ocioso + o incidente real do teste
 * de carga (atraso de 432 ms):
 *
 * ```text
 *   uptime  6 min → p90 432 ms  (enxerga)
 *   uptime  1 h   → p90 432 ms  (enxerga)
 *   uptime 24 h   → p90 0,5 ms  (CEGO durante a saturação)
 * ```
 *
 * E o `max` acumulado não salva: por ser monotônico, um engasgo de GC da
 * semana passada o deixa alto para sempre, indistinguível de agora.
 *
 * Então publicamos os dois, com papéis diferentes:
 * - **`window`** — janela curta, zerada por um timer a cada
 *   {@link WINDOW_RESET_MS}. É o "agora", o número que decide se HÁ
 *   incidente.
 * - **`cumulative`** — desde que o monitor ligou. Serve de linha de base e
 *   guarda o `maxMs` histórico ("pior de todos os tempos").
 *
 * ## Por que o reset é por TEMPO e não por request
 *
 * Zerar na leitura faria um chamador estragar a leitura do outro (dois
 * monitoramentos, ou um `curl` do operador no meio da coleta, e cada um veria
 * uma janela mutilada). O timer é independente de quem lê: a janela é a
 * mesma para todos, e `window.seconds` diz de quanto tempo ela é — leitura
 * logo após um reset vem com poucos segundos, o que é honesto e visível.
 * Durante saturação SUSTENTADA, mesmo 2 s de janela já mostram o atraso.
 */

/** Intervalo de amostragem do libuv: ~50 medições por segundo, custo desprezível. */
export const EVENT_LOOP_RESOLUTION_MS = 20;

/** De quanto em quanto tempo a janela curta é zerada. */
export const WINDOW_RESET_MS = 60_000;

type EventLoopMonitor = {
  cumulative: IntervalHistogram;
  window: IntervalHistogram;
  startedAt: number;
  windowStartedAt: number;
};

declare global {
  var __rocoEventLoopMonitor: EventLoopMonitor | undefined;
}

/** O que `/api/health` publica sobre o event loop. */
export type EventLoopReading = {
  /**
   * Janela coberta pelo `cumulative`. O Next carrega o módulo da rota na
   * PRIMEIRA requisição a ela, não no boot — sem este campo os números não
   * são interpretáveis.
   */
  monitoringForSeconds: number;
  /** O "agora": janela curta, zerada a cada {@link WINDOW_RESET_MS}. */
  window: DelaySummary & { seconds: number };
  /** Linha de base desde que o monitor ligou; `maxMs` é o pior de todos os tempos. */
  cumulative: DelaySummary;
};

function createMonitor(): EventLoopMonitor {
  const cumulative = monitorEventLoopDelay({ resolution: EVENT_LOOP_RESOLUTION_MS });
  cumulative.enable();

  const window = monitorEventLoopDelay({ resolution: EVENT_LOOP_RESOLUTION_MS });
  window.enable();

  const now = Date.now();
  const monitor: EventLoopMonitor = {
    cumulative,
    window,
    startedAt: now,
    windowStartedAt: now,
  };

  const timer = setInterval(() => {
    monitor.window.reset();
    monitor.windowStartedAt = Date.now();
  }, WINDOW_RESET_MS);
  // `unref` para o timer NUNCA segurar o processo vivo: um health check não
  // pode ser o motivo de um container não terminar no `docker stop`.
  timer.unref();

  return monitor;
}

/**
 * Lê o estado atual. O monitor é criado na primeira chamada (lazy) e guardado
 * em `globalThis` — assim o HMR do dev não acumula histogramas e timers a
 * cada recompilação, e a leitura é a mesma em qualquer bundle do processo.
 */
export function readEventLoopDelay(): EventLoopReading {
  const monitor = (globalThis.__rocoEventLoopMonitor ??= createMonitor());
  const now = Date.now();

  return {
    monitoringForSeconds: Math.round((now - monitor.startedAt) / 1000),
    window: {
      seconds: Math.round((now - monitor.windowStartedAt) / 1000),
      ...summarizeHistogram(monitor.window, EVENT_LOOP_RESOLUTION_MS),
    },
    cumulative: summarizeHistogram(monitor.cumulative, EVENT_LOOP_RESOLUTION_MS),
  };
}
