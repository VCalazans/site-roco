/**
 * Conversão dos números do histograma de event loop do Node para o que a
 * gente realmente quer publicar em `/api/health`.
 *
 * Vive fora do `route.ts` porque arquivo de rota do App Router só deveria
 * exportar handlers e config — e porque esta conversão tem casos de borda
 * reais que merecem teste.
 */

/**
 * Nanossegundos do histograma → milissegundos de ATRASO REAL.
 *
 * DOIS problemas do valor cru, os dois já reproduzidos nesta base:
 *
 * 1. **Ele não é "atraso".** O histograma mede o intervalo CHEIO entre
 *    disparos do timer de amostragem, que já embute os `resolutionMs`
 *    esperados. Num processo COMPLETAMENTE ocioso com resolution 20 ms, o
 *    `mean` cru medido foi 31 ms (o tick do relógio do Windows é ~15,6 ms;
 *    em Linux, onde isto roda em produção, o tick é 1 ms e o cru fica
 *    ~20 ms). Publicar o cru faria um servidor sem carga nenhuma parecer
 *    saturado — o oposto do que o endpoint existe para mostrar. Por isso
 *    subtraímos o intervalo esperado e cortamos em 0.
 *
 *    O sinal sobrevive à subtração: um bloqueio síncrono de 800 ms levou o
 *    `max` cru de 32 ms para 816 ms.
 *
 * 2. **Histograma vazio devolve `NaN`.** Antes de a primeira amostra ser
 *    coletada (a rota pode ser chamada no mesmo segundo em que o módulo
 *    carrega), `histogram.mean` é `NaN` — e `JSON.stringify(NaN)` vira
 *    `null`, então a resposta saía com `"meanMs": null` no lugar de um
 *    número. Qualquer coisa não finita vira 0 aqui; quem lê sabe que a
 *    janela ainda não vale nada pelo `monitoringForSeconds`, que vem 0
 *    junto.
 *
 * Resíduo conhecido: em Windows (dev local) o piso ocioso fica em ~11 ms
 * por causa do tick de 15,6 ms, não porque haja atraso de verdade.
 */
export function toDelayMs(nanoseconds: number, resolutionMs: number): number {
  if (!Number.isFinite(nanoseconds)) {
    return 0;
  }

  const excess = nanoseconds / 1e6 - resolutionMs;
  if (!Number.isFinite(excess)) {
    return 0;
  }

  return Math.max(0, Math.round(excess * 100) / 100);
}

/** O mínimo que precisamos de um `IntervalHistogram` — assim dá para testar com um duplo. */
export type HistogramLike = {
  readonly mean: number;
  readonly max: number;
  percentile(percentile: number): number;
};

/** Resumo publicável de um histograma de atraso, já em milissegundos. */
export type DelaySummary = {
  meanMs: number;
  p90Ms: number;
  p99Ms: number;
  maxMs: number;
};

/**
 * Converte um histograma inteiro para o resumo publicado em `/api/health`.
 *
 * `percentile()` LANÇA quando o histograma ainda não tem amostra em algumas
 * versões do Node (e devolve valores absurdos em outras — ver os casos de
 * borda testados em `toDelayMs`). Como esta função roda dentro de um health
 * check, ela nunca pode ser a causa de um erro: qualquer exceção vira 0, que
 * é o mesmo valor que uma janela vazia produziria.
 */
export function summarizeHistogram(
  histogram: HistogramLike,
  resolutionMs: number
): DelaySummary {
  const percentile = (value: number): number => {
    try {
      return toDelayMs(histogram.percentile(value), resolutionMs);
    } catch {
      return 0;
    }
  };

  return {
    meanMs: toDelayMs(histogram.mean, resolutionMs),
    p90Ms: percentile(90),
    p99Ms: percentile(99),
    maxMs: toDelayMs(histogram.max, resolutionMs),
  };
}
