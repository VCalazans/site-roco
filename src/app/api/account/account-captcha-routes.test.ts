/**
 * Turnstile nas rotas públicas de conta que mandam link por e-mail ("esqueci
 * minha senha" e "reenviar confirmação"): a verificação vem logo depois de ler
 * o corpo, ANTES do schema e de qualquer consulta — então a recusa não diz
 * nada sobre a conta existir. Banco, limitador e envio são mocks; o `fetch`
 * global é o siteverify da Cloudflare.
 */
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  checkRateLimit: vi.fn(),
  findActiveUserByEmail: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: mocks.after,
}));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/server/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/lib/rate-limit")>()),
  checkRateLimit: mocks.checkRateLimit,
}));
vi.mock("@/server/lib/account-service", () => ({
  findActiveUserByEmail: mocks.findActiveUserByEmail,
  sendPasswordResetEmail: vi.fn(),
  sendVerificationEmail: vi.fn(),
}));

import { POST as forgotPassword } from "./password/forgot/route";
import { POST as resendVerification } from "./verification/resend/route";

const DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";
const fetchMock = vi.fn();

function siteverify(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

function accountRequest(path: string, body: unknown): NextRequest {
  const text = JSON.stringify(body);
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.23" },
    body: text,
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("TURNSTILE_SECRET_KEY", "1x0000000000000000000000000000000AA");
  vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "1x00000000000000000000AA");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 5, retryAfterSeconds: 0 });
});

afterEach(() => {
  fetchMock.mockReset();
  mocks.after.mockReset();
  mocks.checkRateLimit.mockReset();
  mocks.findActiveUserByEmail.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe.each([
  { name: "esqueci minha senha", path: "/api/account/password/forgot", POST: forgotPassword, action: "senha" },
  {
    name: "reenviar confirmação",
    path: "/api/account/verification/resend",
    POST: resendVerification,
    action: "confirmacao",
  },
])("POST $path ($name) — Turnstile", ({ path, POST, action }) => {
  it("sem token: 400 `captcha` sem consultar a conta nem cobrar o limite por e-mail", async () => {
    const response = await POST(accountRequest(path, { email: "pessoa@exemplo.com.br", locale: "pt" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "captcha" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.after).not.toHaveBeenCalled();
    expect(mocks.findActiveUserByEmail).not.toHaveBeenCalled();
    expect(mocks.checkRateLimit).toHaveBeenCalledTimes(1);
  });

  it("token de outra ação: 400 `captcha`", async () => {
    fetchMock.mockResolvedValueOnce(siteverify({ success: true, action: "login" }));

    const response = await POST(
      accountRequest(path, { email: "pessoa@exemplo.com.br", locale: "pt", turnstileToken: DUMMY_TOKEN })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "captcha" });
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("Cloudflare fora do ar: 503 `captcha_unavailable`", async () => {
    fetchMock.mockRejectedValueOnce(new DOMException("timeout", "TimeoutError"));

    const response = await POST(
      accountRequest(path, { email: "pessoa@exemplo.com.br", locale: "pt", turnstileToken: DUMMY_TOKEN })
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "captcha_unavailable" });
  });

  it(`token válido (ação \`${action}\`): resposta genérica e o envio agendado para depois`, async () => {
    fetchMock.mockResolvedValueOnce(siteverify({ success: true, action }));

    const response = await POST(
      accountRequest(path, { email: "pessoa@exemplo.com.br", locale: "pt", turnstileToken: DUMMY_TOKEN })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.after).toHaveBeenCalledTimes(1);
    // A consulta à conta só roda DEPOIS da resposta (`after`), nunca antes.
    expect(mocks.findActiveUserByEmail).not.toHaveBeenCalled();
  });

  it("token válido com e-mail inválido: 400 `validation` (o schema vem depois do Turnstile)", async () => {
    fetchMock.mockResolvedValueOnce(siteverify({ success: true, action }));

    const response = await POST(accountRequest(path, { email: "não-é-email", turnstileToken: DUMMY_TOKEN }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "validation" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new URLSearchParams(String((fetchMock.mock.calls[0][1] as RequestInit).body)).get("response")).toBe(
      DUMMY_TOKEN
    );
  });

  it("corpo que não é JSON: 400 `validation` sem chamar a Cloudflare", async () => {
    const request = new NextRequest(`http://localhost${path}`, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "email=pessoa@exemplo.com.br",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
