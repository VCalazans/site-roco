/**
 * Turnstile no pré-cadastro público de representantes: limite por IP → corpo →
 * honeypot → Turnstile (ação `cadastro`) → schema → tetos de volume → banco.
 * Banco, limitador e e-mail são mocks; o `fetch` global é o siteverify.
 */
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  dbSelect: vi.fn(),
  dbTransaction: vi.fn(),
}));

vi.mock("@/db", () => ({ db: { select: mocks.dbSelect, transaction: mocks.dbTransaction } }));
vi.mock("@/server/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/lib/rate-limit")>()),
  checkRateLimit: mocks.checkRateLimit,
}));
vi.mock("@/server/lib/account-service", () => ({
  purgeStaleAccountData: vi.fn(),
  sendVerificationEmail: vi.fn(),
}));

import { POST } from "./route";

const DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";
const fetchMock = vi.fn();

function registerRequest(body: unknown): NextRequest {
  const text = JSON.stringify(body);
  return new NextRequest("http://localhost/api/representatives/register", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.23" },
    body: text,
  });
}

function siteverify(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
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
  mocks.checkRateLimit.mockReset();
  mocks.dbSelect.mockReset();
  mocks.dbTransaction.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/representatives/register — Turnstile", () => {
  it("honeypot preenchido: sucesso silencioso, sem chamar a Cloudflare", async () => {
    const response = await POST(registerRequest({ website: "spam" }));

    expect(response.status).toBe(201);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.dbSelect).not.toHaveBeenCalled();
  });

  it("sem token: 400 `captcha` antes do schema, dos tetos de volume e do banco", async () => {
    const response = await POST(registerRequest({ name: "Ana Souza", email: "ana@exemplo.com.br" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "captcha" });
    expect(mocks.checkRateLimit).toHaveBeenCalledTimes(1);
    expect(mocks.dbSelect).not.toHaveBeenCalled();
  });

  it("token de outra ação (ex.: do login): 400 `captcha`", async () => {
    fetchMock.mockResolvedValueOnce(siteverify({ success: true, action: "login" }));

    const response = await POST(registerRequest({ turnstileToken: DUMMY_TOKEN }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "captcha" });
  });

  it("Cloudflare fora do ar: 503 `captcha_unavailable`", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));

    const response = await POST(registerRequest({ turnstileToken: DUMMY_TOKEN }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "captcha_unavailable" });
  });

  it("token válido (ação `cadastro`) segue para o schema", async () => {
    fetchMock.mockResolvedValueOnce(siteverify({ success: true, action: "cadastro" }));

    const response = await POST(registerRequest({ name: "Ana Souza", turnstileToken: DUMMY_TOKEN }));

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string; fields: string[] };
    expect(body.error).toBe("validation");
    expect(body.fields).toEqual(expect.arrayContaining(["email", "phone", "cnpj"]));
    expect(mocks.dbSelect).not.toHaveBeenCalled();
  });
});
