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
const { checkRateLimit, getClientIp, normalizeRateLimitKeyPart, resolveClientIp } = await import("./rate-limit");

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
  /** Borda da Cloudflare (172.64.0.0/13) e da faixa IPv6 2606:4700::/32. */
  const CLOUDFLARE_EDGE_V4 = "172.70.1.2";
  const CLOUDFLARE_EDGE_V6 = "2606:4700:10::6814:1234";
  const VISITOR = "203.0.113.9";
  const DIRECT_PEER = "198.51.100.23";

  function requestWith(headers: Record<string, string>): Request {
    return new Request("https://example.com", { headers });
  }

  it("pela Cloudflare: usa o cf-connecting-ip, mesmo com o x-forwarded-for forjado no início", () => {
    const request = requestWith({
      "x-forwarded-for": `6.6.6.6, ${VISITOR}, ${CLOUDFLARE_EDGE_V4}`,
      "cf-connecting-ip": VISITOR,
    });

    expect(getClientIp(request)).toBe(VISITOR);
  });

  it("pela Cloudflare sem cf-connecting-ip: usa o item anterior à borda (o IP que a Cloudflare acrescentou)", () => {
    const request = requestWith({ "x-forwarded-for": `6.6.6.6, ${VISITOR}, ${CLOUDFLARE_EDGE_V4}` });

    expect(getClientIp(request)).toBe(VISITOR);
  });

  it("pela Cloudflare com cf-connecting-ip inválido: cai no item anterior à borda", () => {
    const request = requestWith({
      "x-forwarded-for": `${VISITOR}, ${CLOUDFLARE_EDGE_V4}`,
      "cf-connecting-ip": "nao-e-um-ip",
    });

    expect(getClientIp(request)).toBe(VISITOR);
  });

  it("pela Cloudflare só com a borda na lista: devolve a própria borda", () => {
    const request = requestWith({ "x-forwarded-for": CLOUDFLARE_EDGE_V4 });

    expect(getClientIp(request)).toBe(CLOUDFLARE_EDGE_V4);
  });

  it("borda IPv6 da Cloudflare: usa o cf-connecting-ip (normalizado)", () => {
    const request = requestWith({
      "x-forwarded-for": `2001:db8::5, ${CLOUDFLARE_EDGE_V6}`,
      "cf-connecting-ip": "2001:DB8::5",
    });

    expect(getClientIp(request)).toBe("2001:db8::5");
  });

  it("direto na origem: ignora o cf-connecting-ip forjado e usa o par TCP do proxy", () => {
    const request = requestWith({
      "x-forwarded-for": DIRECT_PEER,
      "cf-connecting-ip": "1.2.3.4",
    });

    expect(getClientIp(request)).toBe(DIRECT_PEER);
  });

  it("direto na origem: ignora o x-forwarded-for forjado pelo cliente (usa o ÚLTIMO item, nunca o primeiro)", () => {
    const request = requestWith({ "x-forwarded-for": `1.1.1.1, 10.0.0.7, ${DIRECT_PEER}` });

    expect(getClientIp(request)).toBe(DIRECT_PEER);
  });

  it("direto na origem fingindo ser a Cloudflare no início da lista: o par TCP decide", () => {
    const request = requestWith({
      "x-forwarded-for": `${CLOUDFLARE_EDGE_V4}, ${DIRECT_PEER}`,
      "cf-connecting-ip": "1.2.3.4",
    });

    expect(getClientIp(request)).toBe(DIRECT_PEER);
  });

  it("desembrulha IPv4 mapeado em IPv6 (::ffff:)", () => {
    expect(getClientIp(requestWith({ "x-forwarded-for": `::ffff:${DIRECT_PEER}` }))).toBe(DIRECT_PEER);
    expect(
      getClientIp(
        requestWith({ "x-forwarded-for": `::ffff:${CLOUDFLARE_EDGE_V4}`, "cf-connecting-ip": `::ffff:${VISITOR}` })
      )
    ).toBe(VISITOR);
  });

  it("descarta a porta anexada por alguns proxies", () => {
    expect(getClientIp(requestWith({ "x-forwarded-for": `${DIRECT_PEER}:51234` }))).toBe(DIRECT_PEER);
    expect(getClientIp(requestWith({ "x-forwarded-for": "[2001:db8::7]:443" }))).toBe("2001:db8::7");
  });

  it("normaliza espaços e caixa alta", () => {
    expect(getClientIp(requestWith({ "x-forwarded-for": "  2001:DB8::1  " }))).toBe("2001:db8::1");
  });

  it("sem x-forwarded-for: usa o x-real-ip", () => {
    expect(getClientIp(requestWith({ "x-real-ip": DIRECT_PEER }))).toBe(DIRECT_PEER);
  });

  it("lixo no x-forwarded-for: o item anterior (do cliente) nunca vira o par TCP", () => {
    expect(getClientIp(requestWith({ "x-forwarded-for": "lixo" }))).toBe("unknown");
    expect(getClientIp(requestWith({ "x-forwarded-for": `lixo, ${DIRECT_PEER}` }))).toBe(DIRECT_PEER);
    expect(getClientIp(requestWith({ "x-forwarded-for": `${VISITOR}, lixo` }))).toBe("unknown");
    expect(getClientIp(requestWith({ "x-forwarded-for": "lixo", "x-real-ip": DIRECT_PEER }))).toBe(DIRECT_PEER);
  });

  it("retorna 'unknown' sem nenhum cabeçalho de IP", () => {
    expect(getClientIp(new Request("https://example.com"))).toBe("unknown");
  });

  it("retorna 'unknown' com o cabeçalho vazio — e nunca confia no cf-connecting-ip sozinho", () => {
    expect(getClientIp(requestWith({ "x-forwarded-for": "" }))).toBe("unknown");
    expect(getClientIp(requestWith({ "cf-connecting-ip": VISITOR }))).toBe("unknown");
  });

  describe("resolveClientIp (diagnóstico das métricas do /api/health)", () => {
    it("pela Cloudflare: viaCloudflare e a contagem de itens do x-forwarded-for", () => {
      const request = requestWith({
        "x-forwarded-for": `6.6.6.6, ${VISITOR}, ${CLOUDFLARE_EDGE_V4}`,
        "cf-connecting-ip": VISITOR,
      });

      expect(resolveClientIp(request)).toEqual({ ip: VISITOR, viaCloudflare: true, forwardedHops: 3 });
    });

    it("par TCP interno (ingress do Docker trocando o IP): não é Cloudflare — o sinal de configuração errada", () => {
      const request = requestWith({ "x-forwarded-for": `${VISITOR}, 10.0.0.2`, "cf-connecting-ip": VISITOR });

      expect(resolveClientIp(request)).toEqual({ ip: "10.0.0.2", viaCloudflare: false, forwardedHops: 2 });
    });

    it("sem cabeçalho nenhum", () => {
      expect(resolveClientIp(new Request("https://example.com"))).toEqual({
        ip: "unknown",
        viaCloudflare: false,
        forwardedHops: 0,
      });
    });

    it("concorda com getClientIp", () => {
      const request = requestWith({ "x-forwarded-for": `${DIRECT_PEER}`, "cf-connecting-ip": "1.2.3.4" });

      expect(resolveClientIp(request).ip).toBe(getClientIp(request));
    });
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
