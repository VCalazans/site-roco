/**
 * Ordem das checagens de `POST /api/contact` em relação ao Turnstile: limite
 * por IP → corpo → honeypot → Turnstile → schema → teto global → banco. Banco,
 * limitador e canais de saída são mocks — nada aqui toca rede, Redis ou Postgres
 * (o `fetch` global é o siteverify da Cloudflare, também mockado).
 */
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  dbInsert: vi.fn(),
  dbTransaction: vi.fn(),
  dbUpdate: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: { insert: mocks.dbInsert, transaction: mocks.dbTransaction, update: mocks.dbUpdate },
}));
vi.mock("@/server/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/lib/rate-limit")>()),
  checkRateLimit: mocks.checkRateLimit,
}));
vi.mock("@/server/lib/public-products", () => ({
  getPublicProductBySlug: vi.fn(),
  getPublicProductsBySlugs: vi.fn(),
}));
vi.mock("@/server/lib/rd-station-send", () => ({ sendRdStationConversion: vi.fn() }));
vi.mock("@/server/lib/contact-email-send", () => ({ sendContactNotificationEmail: vi.fn() }));

import { POST } from "./route";

const DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";
const fetchMock = vi.fn();

function contactRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/contact", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.23" },
    body: JSON.stringify(body),
  });
}

function siteverify(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** Token que a rota mandou ao siteverify (corpo form-urlencoded da primeira chamada). */
function sentToken(): string | null {
  const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
  return init ? new URLSearchParams(String(init.body)).get("response") : null;
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
  mocks.dbInsert.mockReset();
  mocks.dbTransaction.mockReset();
  mocks.dbUpdate.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/contact — Turnstile", () => {
  it("honeypot preenchido: sucesso silencioso, sem gastar chamada à Cloudflare", async () => {
    const response = await POST(contactRequest({ website: "http://spam.example", subject: "general" }));

    expect(response.status).toBe(201);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.dbInsert).not.toHaveBeenCalled();
  });

  it("sem token: 400 `captcha`, antes do schema, do teto global e do banco", async () => {
    const response = await POST(contactRequest({ subject: "general", name: "Ana" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "captcha" });
    expect(fetchMock).not.toHaveBeenCalled();
    // Só o limite por IP foi cobrado: recusa do Turnstile não gasta o balde global.
    expect(mocks.checkRateLimit).toHaveBeenCalledTimes(1);
    expect(String(mocks.checkRateLimit.mock.calls[0][0])).toContain("contact:ip:");
    expect(mocks.dbInsert).not.toHaveBeenCalled();
  });

  it("token recusado pela Cloudflare: 400 `captcha`", async () => {
    fetchMock.mockResolvedValueOnce(siteverify({ success: false, "error-codes": ["invalid-input-response"] }));

    const response = await POST(contactRequest({ subject: "general", turnstileToken: "forjado" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "captcha" });
    expect(sentToken()).toBe("forjado");
  });

  it("Cloudflare fora do ar: 503 `captcha_unavailable` (fail-closed)", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));

    const response = await POST(contactRequest({ subject: "general", turnstileToken: DUMMY_TOKEN }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "captcha_unavailable" });
  });

  it("token válido segue para o schema (aqui reprovado: 400 `validation` com os campos)", async () => {
    fetchMock.mockResolvedValueOnce(siteverify({ success: true, action: "contato" }));

    const response = await POST(contactRequest({ subject: "quote", locale: "pt", turnstileToken: DUMMY_TOKEN }));

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string; fields: string[] };
    expect(body.error).toBe("validation");
    expect(body.fields).toEqual(expect.arrayContaining(["name", "email", "phone", "consent"]));
    expect(sentToken()).toBe(DUMMY_TOKEN);
    expect(mocks.dbInsert).not.toHaveBeenCalled();
  });

  it("a ação esperada vem do assunto: token do formulário de contato não serve no catálogo", async () => {
    fetchMock.mockResolvedValueOnce(siteverify({ success: true, action: "contato" }));

    const response = await POST(contactRequest({ subject: "catalog", turnstileToken: DUMMY_TOKEN }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "captcha" });
  });

  it.each([
    ["catalog", "catalogo"],
    ["cart", "orcamento"],
    ["call_back", "contato"],
  ])("assunto `%s` aceita a ação `%s`", async (subject, action) => {
    fetchMock.mockResolvedValueOnce(siteverify({ success: true, action }));

    const response = await POST(contactRequest({ subject, turnstileToken: DUMMY_TOKEN }));

    // Passou pelo Turnstile; parou no schema (corpo incompleto de propósito).
    await expect(response.json()).resolves.toMatchObject({ error: "validation" });
  });

  it("sem TURNSTILE_SECRET_KEY: não exige token (dev/homologação) e segue para o schema", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");

    const response = await POST(contactRequest({ subject: "general" }));

    await expect(response.json()).resolves.toMatchObject({ error: "validation" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
