import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  interpretSiteverifyResponse,
  TURNSTILE_SITEVERIFY_URL,
  TURNSTILE_VERIFY_TIMEOUT_MS,
  turnstileRejection,
  turnstileTokenFrom,
  verifyTurnstile,
} from "./turnstile";
import { TURNSTILE_ACTIONS, TURNSTILE_TOKEN_MAX_LENGTH } from "@/shared/lib/turnstile";

/** Segredo de TESTE público da Cloudflare (sempre aprova) — não é credencial. */
const TEST_SECRET = "1x0000000000000000000000000000000AA";
const TEST_SITE_KEY = "1x00000000000000000000AA";
const DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

type GlobalWithTurnstileState = typeof globalThis & {
  __rocoTurnstileWarned?: unknown;
  __rocoTurnstileLog?: unknown;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("interpretSiteverifyResponse", () => {
  it("aprova `success: true` sem ação (as chaves de teste respondem assim)", () => {
    expect(interpretSiteverifyResponse({ success: true, "error-codes": [] }, "contato")).toEqual({ ok: true });
  });

  it("aprova quando a ação devolvida é a esperada", () => {
    expect(interpretSiteverifyResponse({ success: true, action: "login" }, "login")).toEqual({ ok: true });
  });

  it("aprova ação vazia (só a ação NÃO vazia precisa bater)", () => {
    expect(interpretSiteverifyResponse({ success: true, action: "" }, "cadastro")).toEqual({ ok: true });
  });

  it("recusa token de OUTRA ação (ex.: gerado no catálogo, usado no login)", () => {
    expect(interpretSiteverifyResponse({ success: true, action: "catalogo" }, "login")).toEqual({
      ok: false,
      code: "invalid",
      reason: "action-mismatch",
    });
  });

  it("recusa `success: false` com os error-codes como motivo", () => {
    expect(
      interpretSiteverifyResponse({ success: false, "error-codes": ["invalid-input-response"] }, "contato")
    ).toEqual({ ok: false, code: "invalid", reason: "invalid-input-response" });
    expect(
      interpretSiteverifyResponse({ success: false, "error-codes": ["timeout-or-duplicate"] }, "contato")
    ).toMatchObject({ ok: false, code: "invalid" });
  });

  it("`success: false` sem códigos ainda é recusa", () => {
    expect(interpretSiteverifyResponse({ success: false }, "contato")).toEqual({
      ok: false,
      code: "invalid",
      reason: "rejected",
    });
  });

  it("segredo errado ou falha interna da Cloudflare é `unavailable`, não culpa do visitante", () => {
    for (const code of ["invalid-input-secret", "missing-input-secret", "internal-error"]) {
      expect(interpretSiteverifyResponse({ success: false, "error-codes": [code] }, "senha")).toMatchObject({
        ok: false,
        code: "unavailable",
      });
    }
  });

  it.each([null, undefined, "ok", 42, [], {}, { success: "true" }, { "error-codes": [] }])(
    "resposta malformada (%j) é `unavailable` — nunca aprovação",
    (payload) => {
      expect(interpretSiteverifyResponse(payload, "contato")).toEqual({
        ok: false,
        code: "unavailable",
        reason: "malformed-response",
      });
    }
  );

  it("filtra códigos de erro estranhos antes de usá-los como motivo (vão para o log)", () => {
    const result = interpretSiteverifyResponse(
      { success: false, "error-codes": ["invalid-input-response", 7, "com espaço\nquebra"] },
      "contato"
    );
    expect(result).toEqual({ ok: false, code: "invalid", reason: "invalid-input-response" });
  });
});

describe("turnstileRejection", () => {
  it("token ausente ou inválido → `captcha` (400)", () => {
    expect(turnstileRejection("missing")).toEqual({ error: "captcha", status: 400 });
    expect(turnstileRejection("invalid")).toEqual({ error: "captcha", status: 400 });
  });

  it("sem como validar → `captcha_unavailable` (503)", () => {
    expect(turnstileRejection("unavailable")).toEqual({ error: "captcha_unavailable", status: 503 });
  });
});

describe("turnstileTokenFrom", () => {
  it("lê `turnstileToken` do corpo, sem confiar no tipo", () => {
    expect(turnstileTokenFrom({ turnstileToken: "abc" })).toBe("abc");
    expect(turnstileTokenFrom({ turnstileToken: 12 })).toBe(12);
    expect(turnstileTokenFrom({})).toBeUndefined();
    expect(turnstileTokenFrom(null)).toBeUndefined();
    expect(turnstileTokenFrom("turnstileToken")).toBeUndefined();
  });
});

describe("verifyTurnstile", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("TURNSTILE_SECRET_KEY", TEST_SECRET);
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", TEST_SITE_KEY);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const state = globalThis as GlobalWithTurnstileState;
    delete state.__rocoTurnstileWarned;
    delete state.__rocoTurnstileLog;
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("sem TURNSTILE_SECRET_KEY: pula a verificação sem chamar a Cloudflare", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    await expect(verifyTurnstile({ token: undefined, action: "contato" })).resolves.toEqual({
      ok: true,
      skipped: true,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sem segredo em PRODUÇÃO: avisa no log uma vez só", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "  ");
    vi.stubEnv("NODE_ENV", "production");
    await verifyTurnstile({ token: undefined, action: "contato" });
    await verifyTurnstile({ token: undefined, action: "login" });
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(vi.mocked(console.warn).mock.calls[0][0]).toContain("TURNSTILE_SECRET_KEY");
  });

  it.each([undefined, null, "", "   ", 123, { token: "x" }])(
    "com segredo, token ausente (%j) → `missing`, sem chamar a Cloudflare",
    async (token) => {
      await expect(verifyTurnstile({ token, action: "cadastro" })).resolves.toEqual({ ok: false, code: "missing" });
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  it("token acima de 2048 caracteres → `invalid`, sem chamar a Cloudflare", async () => {
    const token = "x".repeat(TURNSTILE_TOKEN_MAX_LENGTH + 1);
    await expect(verifyTurnstile({ token, action: "contato" })).resolves.toEqual({ ok: false, code: "invalid" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("token no teto exato ainda é enviado", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }));
    const token = "x".repeat(TURNSTILE_TOKEN_MAX_LENGTH);
    await expect(verifyTurnstile({ token, action: "contato" })).resolves.toEqual({ ok: true });
  });

  it("aprovado: POST form-urlencoded com segredo, token, IP e idempotency_key (UUID), com timeout", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, action: "login" }));

    await expect(
      verifyTurnstile({ token: DUMMY_TOKEN, action: TURNSTILE_ACTIONS.login, remoteIp: "203.0.113.9" })
    ).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(TURNSTILE_SITEVERIFY_URL);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/x-www-form-urlencoded");
    const body = new URLSearchParams(String(init.body));
    expect(body.get("secret")).toBe(TEST_SECRET);
    expect(body.get("response")).toBe(DUMMY_TOKEN);
    expect(body.get("remoteip")).toBe("203.0.113.9");
    expect(body.get("idempotency_key")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(timeoutSpy).toHaveBeenCalledWith(TURNSTILE_VERIFY_TIMEOUT_MS);
  });

  it("IP desconhecido não vai como `remoteip`", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }));
    await verifyTurnstile({ token: DUMMY_TOKEN, action: "contato", remoteIp: "unknown" });
    const body = new URLSearchParams(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body.has("remoteip")).toBe(false);
  });

  it("token recusado pela Cloudflare → `invalid`", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: false, "error-codes": ["invalid-input-response"] }));
    await expect(verifyTurnstile({ token: DUMMY_TOKEN, action: "contato" })).resolves.toEqual({
      ok: false,
      code: "invalid",
    });
  });

  it("token de outra ação → `invalid`", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, action: "catalogo" }));
    await expect(verifyTurnstile({ token: DUMMY_TOKEN, action: "orcamento" })).resolves.toEqual({
      ok: false,
      code: "invalid",
    });
  });

  it("timeout da chamada → `unavailable` (fail-closed)", async () => {
    fetchMock.mockRejectedValueOnce(new DOMException("The operation was aborted due to timeout", "TimeoutError"));
    await expect(verifyTurnstile({ token: DUMMY_TOKEN, action: "senha" })).resolves.toEqual({
      ok: false,
      code: "unavailable",
    });
    expect(vi.mocked(console.error).mock.calls[0][0]).toContain("timeout");
  });

  it("falha de rede → `unavailable` (fail-closed)", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(verifyTurnstile({ token: DUMMY_TOKEN, action: "confirmacao" })).resolves.toEqual({
      ok: false,
      code: "unavailable",
    });
  });

  it("HTTP 5xx da Cloudflare → `unavailable`", async () => {
    fetchMock.mockResolvedValueOnce(new Response("upstream error", { status: 502 }));
    await expect(verifyTurnstile({ token: DUMMY_TOKEN, action: "contato" })).resolves.toEqual({
      ok: false,
      code: "unavailable",
    });
  });

  it("corpo que não é JSON → `unavailable`", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>oops</html>", { status: 200 }));
    await expect(verifyTurnstile({ token: DUMMY_TOKEN, action: "contato" })).resolves.toEqual({
      ok: false,
      code: "unavailable",
    });
  });

  it("nunca registra o token nem o segredo no log", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: false, "error-codes": ["invalid-input-secret"] }));
    await verifyTurnstile({ token: DUMMY_TOKEN, action: "login", remoteIp: "203.0.113.9" });
    const logged = [...vi.mocked(console.error).mock.calls, ...vi.mocked(console.warn).mock.calls].flat().join(" ");
    expect(logged).toContain("TURNSTILE_SECRET_KEY");
    expect(logged).not.toContain(DUMMY_TOKEN);
    expect(logged).not.toContain(TEST_SECRET);
    expect(logged).not.toContain("203.0.113.9");
  });

  it("recusas repetidas não inundam o log (no máximo uma linha por minuto por tipo)", async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ success: false, "error-codes": ["invalid-input-response"] }));
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await verifyTurnstile({ token: DUMMY_TOKEN, action: "contato" });
    }
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("segredo configurado mas build sem site key: avisa alto (uma vez) e segue exigindo o token", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
    await expect(verifyTurnstile({ token: undefined, action: "contato" })).resolves.toEqual({
      ok: false,
      code: "missing",
    });
    await verifyTurnstile({ token: undefined, action: "login" });
    const siteKeyErrors = vi
      .mocked(console.error)
      .mock.calls.filter(([message]) => String(message).includes("NEXT_PUBLIC_TURNSTILE_SITE_KEY"));
    expect(siteKeyErrors).toHaveLength(1);
  });
});
