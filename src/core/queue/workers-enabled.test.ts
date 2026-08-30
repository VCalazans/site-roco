import { describe, expect, it } from "vitest";
import { isWorkersFlagDisabled, resolveWorkerStartup } from "./workers-enabled";

const REDIS = "redis://localhost:6379";

describe("isWorkersFlagDisabled", () => {
  it("desliga com o valor exato 'false'", () => {
    expect(isWorkersFlagDisabled("false")).toBe(true);
  });

  it("desliga ignorando caixa e espaços (evita footgun de YAML/painel)", () => {
    expect(isWorkersFlagDisabled("False")).toBe(true);
    expect(isWorkersFlagDisabled("FALSE")).toBe(true);
    expect(isWorkersFlagDisabled("  false  ")).toBe(true);
  });

  describe("default LIGADO — nenhum ambiente existente muda por omissão", () => {
    it.each([
      ["ausente", undefined],
      ["vazio", ""],
      ["só espaços", "   "],
      ["true", "true"],
      ["1", "1"],
      // "0" NÃO desliga: só a palavra "false" desliga, e isso é deliberado.
      ["zero", "0"],
      ["off", "off"],
      ["no", "no"],
      ["falsey", "falsey"],
      ["disabled", "disabled"],
    ])("mantém ligado com %s", (_label, value) => {
      expect(isWorkersFlagDisabled(value)).toBe(false);
    });
  });
});

describe("resolveWorkerStartup", () => {
  it("sobe os workers no caso normal (Redis presente, flag ausente)", () => {
    expect(resolveWorkerStartup({ redisUrl: REDIS, workersEnabled: undefined })).toEqual({
      start: true,
      redisUrl: REDIS,
    });
  });

  it("sobe os workers com a flag explicitamente ligada", () => {
    expect(resolveWorkerStartup({ redisUrl: REDIS, workersEnabled: "true" })).toEqual({
      start: true,
      redisUrl: REDIS,
    });
  });

  it("não sobe quando a flag desliga, MESMO com Redis configurado", () => {
    // Este é o ponto da feature: desligar o worker sem tirar o Redis, que
    // continua servindo o rate limit de /api/contact (fail-closed).
    expect(resolveWorkerStartup({ redisUrl: REDIS, workersEnabled: "false" })).toEqual({
      start: false,
      reason: "disabled-by-flag",
    });
  });

  it("não sobe sem REDIS_URL", () => {
    expect(resolveWorkerStartup({ redisUrl: undefined, workersEnabled: undefined })).toEqual({
      start: false,
      reason: "missing-redis-url",
    });
  });

  it("trata REDIS_URL vazia ou só com espaços como ausente", () => {
    expect(resolveWorkerStartup({ redisUrl: "", workersEnabled: undefined })).toEqual({
      start: false,
      reason: "missing-redis-url",
    });
    expect(resolveWorkerStartup({ redisUrl: "   ", workersEnabled: undefined })).toEqual({
      start: false,
      reason: "missing-redis-url",
    });
  });

  it("com os dois desligados, reporta a flag — é a intenção do operador", () => {
    expect(resolveWorkerStartup({ redisUrl: undefined, workersEnabled: "false" })).toEqual({
      start: false,
      reason: "disabled-by-flag",
    });
  });

  it("normaliza a URL do Redis devolvida (sem espaços em volta)", () => {
    expect(resolveWorkerStartup({ redisUrl: `  ${REDIS}  `, workersEnabled: undefined })).toEqual({
      start: true,
      redisUrl: REDIS,
    });
  });
});
