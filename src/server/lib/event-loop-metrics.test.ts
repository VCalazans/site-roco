import { describe, expect, it } from "vitest";
import { summarizeHistogram, toDelayMs, type HistogramLike } from "./event-loop-metrics";

const RESOLUTION = 20;
const ms = (value: number) => value * 1e6;

describe("toDelayMs", () => {
  describe("desconta o intervalo de amostragem", () => {
    it("processo ocioso em Linux (cru ≈ resolution) reporta ~0", () => {
      expect(toDelayMs(ms(20), RESOLUTION)).toBe(0);
    });

    it("processo ocioso em Windows (cru ≈ 31 ms pelo tick de 15,6 ms) NÃO reporta 31", () => {
      // O número cru medido nesta base num processo sem carga nenhuma.
      // Publicá-lo faria um servidor ocioso parecer saturado.
      expect(toDelayMs(ms(31), RESOLUTION)).toBe(11);
    });

    it("nunca devolve negativo quando o cru fica abaixo do intervalo", () => {
      expect(toDelayMs(ms(5), RESOLUTION)).toBe(0);
      expect(toDelayMs(0, RESOLUTION)).toBe(0);
    });
  });

  describe("preserva o sinal de saturação", () => {
    it("bloqueio de 800 ms (cru 816) continua gritando", () => {
      // Valor real medido bloqueando o event loop por 800 ms.
      expect(toDelayMs(ms(816), RESOLUTION)).toBe(796);
    });

    it("saturação sustentada (p90 de 432 ms no teste de carga) sobrevive", () => {
      expect(toDelayMs(ms(432), RESOLUTION)).toBe(412);
    });

    it("arredonda para 2 casas", () => {
      expect(toDelayMs(ms(20.123456), RESOLUTION)).toBe(0.12);
      expect(toDelayMs(ms(25.5), RESOLUTION)).toBe(5.5);
    });
  });

  describe("histograma vazio (antes da primeira amostra)", () => {
    it("mean NaN vira 0 — senão o JSON sairia com null no lugar do número", () => {
      // `histogram.mean` é NaN sem amostras e JSON.stringify(NaN) === "null".
      expect(toDelayMs(NaN, RESOLUTION)).toBe(0);
      expect(JSON.stringify({ meanMs: toDelayMs(NaN, RESOLUTION) })).toBe('{"meanMs":0}');
    });

    it("max 0 de histograma vazio vira 0", () => {
      expect(toDelayMs(0, RESOLUTION)).toBe(0);
    });

    it("percentil de histograma vazio (511 ns) vira 0", () => {
      // Valor real devolvido por percentile(90) sem amostras.
      expect(toDelayMs(511, RESOLUTION)).toBe(0);
    });

    it("min de histograma vazio (2^63) não explode", () => {
      expect(toDelayMs(9223372036854776000, RESOLUTION)).toBeGreaterThan(0);
    });

    it("Infinity vira 0 em vez de virar null no JSON", () => {
      expect(toDelayMs(Infinity, RESOLUTION)).toBe(0);
      expect(toDelayMs(-Infinity, RESOLUTION)).toBe(0);
    });
  });

  it("todo resultado é finito e serializável como número", () => {
    const entradas = [NaN, Infinity, -Infinity, 0, 511, ms(20), ms(816), 9223372036854776000];
    for (const entrada of entradas) {
      const resultado = toDelayMs(entrada, RESOLUTION);
      expect(Number.isFinite(resultado)).toBe(true);
      expect(JSON.stringify(resultado)).not.toBe("null");
    }
  });
});

describe("summarizeHistogram", () => {
  const fake = (values: {
    mean: number;
    max: number;
    percentiles?: Record<number, number>;
    throws?: boolean;
  }): HistogramLike => ({
    mean: values.mean,
    max: values.max,
    percentile(percentile: number) {
      if (values.throws) {
        throw new Error("empty histogram");
      }
      return values.percentiles?.[percentile] ?? 0;
    },
  });

  it("converte todos os campos descontando o intervalo de amostragem", () => {
    const histogram = fake({
      mean: ms(120),
      max: ms(816),
      percentiles: { 90: ms(432), 99: ms(700) },
    });

    expect(summarizeHistogram(histogram, RESOLUTION)).toEqual({
      meanMs: 100,
      p90Ms: 412,
      p99Ms: 680,
      maxMs: 796,
    });
  });

  it("janela ociosa vira zeros em vez de ~20 ms de ruído", () => {
    const histogram = fake({ mean: ms(20), max: ms(21), percentiles: { 90: ms(20), 99: ms(20) } });
    expect(summarizeHistogram(histogram, RESOLUTION)).toEqual({
      meanMs: 0,
      p90Ms: 0,
      p99Ms: 0,
      maxMs: 1,
    });
  });

  it("histograma recém-zerado (mean NaN) sai como número, não null no JSON", () => {
    const histogram = fake({ mean: NaN, max: 0, percentiles: { 90: 511, 99: 511 } });
    const resumo = summarizeHistogram(histogram, RESOLUTION);

    expect(resumo).toEqual({ meanMs: 0, p90Ms: 0, p99Ms: 0, maxMs: 0 });
    expect(JSON.stringify(resumo)).not.toContain("null");
  });

  it("percentile que LANÇA não derruba o health check", () => {
    // Algumas versões do Node lançam ao pedir percentil de histograma vazio.
    // Um health check nunca pode ser a causa de um 500.
    const histogram = fake({ mean: ms(25), max: ms(30), throws: true });
    expect(summarizeHistogram(histogram, RESOLUTION)).toEqual({
      meanMs: 5,
      p90Ms: 0,
      p99Ms: 0,
      maxMs: 10,
    });
  });

  it("todo campo é finito e serializável", () => {
    const histogram = fake({ mean: Infinity, max: NaN, percentiles: { 90: -Infinity, 99: NaN } });
    const resumo = summarizeHistogram(histogram, RESOLUTION);

    for (const valor of Object.values(resumo)) {
      expect(Number.isFinite(valor)).toBe(true);
    }
  });
});
