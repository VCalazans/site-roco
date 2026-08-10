import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const incrMock = vi.fn();
const expireMock = vi.fn();
const execMock = vi.fn();
const ttlMock = vi.fn();
const onMock = vi.fn();
const redisConstructorMock = vi.fn();

/** Encadeia `.incr().expire().exec()` como o cliente real do ioredis. */
function buildMultiChain() {
  const chain = {
    incr: (...args: unknown[]) => {
      incrMock(...args);
      return chain;
    },
    expire: (...args: unknown[]) => {
      expireMock(...args);
      return chain;
    },
    exec: execMock,
  };
  return chain;
}

vi.mock("ioredis", () => {
  class MockRedis {
    constructor(...args: unknown[]) {
      redisConstructorMock(...args);
    }
    multi() {
      return buildMultiChain();
    }
    ttl(key: string) {
      return ttlMock(key);
    }
    on(event: string, callback: (...args: unknown[]) => void) {
      onMock(event, callback);
    }
  }
  return { default: MockRedis };
});

// Importado depois do `vi.mock` (hoisted) para garantir que o módulo mockado
// seja o resolvido dentro de rate-limit.ts.
const { checkRateLimit, getClientIp, normalizeRateLimitKeyPart } = await import("./rate-limit");

type GlobalWithRateLimitCache = typeof globalThis & {
  __rocoRateLimitRedis?: unknown;
  __rocoRateLimitWarned?: boolean;
};

const globalCache = globalThis as GlobalWithRateLimitCache;

function resetModuleState() {
  delete process.env.REDIS_URL;
  globalCache.__rocoRateLimitRedis = undefined;
  globalCache.__rocoRateLimitWarned = undefined;
  vi.clearAllMocks();
}

describe("checkRateLimit", () => {
  beforeEach(() => {
    resetModuleState();
  });

  afterEach(() => {
    resetModuleState();
  });

  describe("fail-open sem REDIS_URL", () => {
    it("permite sempre e não toca o cliente Redis", async () => {
      const result = await checkRateLimit("login:email:test@roco.com.br", {
        windowSeconds: 300,
        max: 5,
      });

      expect(result).toEqual({ allowed: true, remaining: 5, retryAfterSeconds: 0 });
      expect(redisConstructorMock).not.toHaveBeenCalled();
    });

    it("loga o warning apenas uma vez mesmo com múltiplas chamadas", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await checkRateLimit("a", { windowSeconds: 60, max: 10 });
      await checkRateLimit("b", { windowSeconds: 60, max: 10 });
      await checkRateLimit("c", { windowSeconds: 60, max: 10 });

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain("[rate-limit]");
      warnSpy.mockRestore();
    });
  });

  describe("com REDIS_URL configurada", () => {
    beforeEach(() => {
      process.env.REDIS_URL = "redis://localhost:6379";
    });

    it("permite quando a contagem está dentro do limite", async () => {
      execMock.mockResolvedValueOnce([[null, 3]]);

      const result = await checkRateLimit("webhook:erp", { windowSeconds: 60, max: 5 });

      expect(result).toEqual({ allowed: true, remaining: 2, retryAfterSeconds: 0 });
      expect(ttlMock).not.toHaveBeenCalled();
    });

    it("permite quando a contagem é exatamente o máximo", async () => {
      execMock.mockResolvedValueOnce([[null, 5]]);

      const result = await checkRateLimit("webhook:erp", { windowSeconds: 60, max: 5 });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);
    });

    it("bloqueia quando a contagem excede o máximo, retornando retryAfterSeconds do TTL", async () => {
      execMock.mockResolvedValueOnce([[null, 6]]);
      ttlMock.mockResolvedValueOnce(42);

      const result = await checkRateLimit("webhook:erp", { windowSeconds: 60, max: 5 });

      expect(result).toEqual({ allowed: false, remaining: 0, retryAfterSeconds: 42 });
    });

    it("usa windowSeconds como fallback quando TTL não está disponível (-1/0)", async () => {
      execMock.mockResolvedValueOnce([[null, 10]]);
      ttlMock.mockResolvedValueOnce(-1);

      const result = await checkRateLimit("webhook:erp", { windowSeconds: 60, max: 5 });

      expect(result.allowed).toBe(false);
      expect(result.retryAfterSeconds).toBe(60);
    });

    it("envia a chave prefixada com 'ratelimit:' para o INCR", async () => {
      execMock.mockResolvedValueOnce([[null, 1]]);

      await checkRateLimit("login:email:foo@roco.com.br", { windowSeconds: 300, max: 5 });

      expect(incrMock).toHaveBeenCalledWith("ratelimit:login:email:foo@roco.com.br");
    });

    it("usa EXPIRE com flag NX (só define TTL na primeira chamada da janela)", async () => {
      execMock.mockResolvedValueOnce([[null, 1]]);

      await checkRateLimit("presign:user:abc", { windowSeconds: 300, max: 30 });

      expect(expireMock).toHaveBeenCalledWith("ratelimit:presign:user:abc", 300, "NX");
    });

    it("fail-open quando exec() retorna null (transação abortada)", async () => {
      execMock.mockResolvedValueOnce(null);

      const result = await checkRateLimit("webhook:erp", { windowSeconds: 60, max: 5 });

      expect(result).toEqual({ allowed: true, remaining: 5, retryAfterSeconds: 0 });
    });

    it("fail-open quando o INCR retorna um erro dentro da transação", async () => {
      execMock.mockResolvedValueOnce([[new Error("boom"), null]]);

      const result = await checkRateLimit("webhook:erp", { windowSeconds: 60, max: 5 });

      expect(result).toEqual({ allowed: true, remaining: 5, retryAfterSeconds: 0 });
    });

    it("fail-open quando exec() rejeita (conexão caiu)", async () => {
      execMock.mockRejectedValueOnce(new Error("connection lost"));

      const result = await checkRateLimit("webhook:erp", { windowSeconds: 60, max: 5 });

      expect(result).toEqual({ allowed: true, remaining: 5, retryAfterSeconds: 0 });
    });

    it("reaproveita o mesmo cliente Redis entre chamadas (cache em globalThis)", async () => {
      execMock.mockResolvedValue([[null, 1]]);

      await checkRateLimit("a", { windowSeconds: 60, max: 5 });
      await checkRateLimit("b", { windowSeconds: 60, max: 5 });

      expect(redisConstructorMock).toHaveBeenCalledTimes(1);
    });
  });
});

describe("getClientIp", () => {
  it("retorna o primeiro IP de x-forwarded-for", () => {
    const request = new Request("https://example.com", {
      headers: { "x-forwarded-for": "203.0.113.4, 10.0.0.1" },
    });

    expect(getClientIp(request)).toBe("203.0.113.4");
  });

  it("normaliza espaços e caixa alta", () => {
    const request = new Request("https://example.com", {
      headers: { "x-forwarded-for": "  2001:DB8::1  " },
    });

    expect(getClientIp(request)).toBe("2001:db8::1");
  });

  it("retorna 'unknown' quando o header está ausente", () => {
    const request = new Request("https://example.com");

    expect(getClientIp(request)).toBe("unknown");
  });

  it("retorna 'unknown' quando o header está vazio", () => {
    const request = new Request("https://example.com", {
      headers: { "x-forwarded-for": "" },
    });

    expect(getClientIp(request)).toBe("unknown");
  });
});

describe("normalizeRateLimitKeyPart", () => {
  it("aplica trim e lowercase", () => {
    expect(normalizeRateLimitKeyPart("  Foo@Bar.COM  ")).toBe("foo@bar.com");
  });

  it("é idempotente", () => {
    const once = normalizeRateLimitKeyPart("Already@Lower.com");
    expect(normalizeRateLimitKeyPart(once)).toBe(once);
  });
});
