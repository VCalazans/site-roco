import { describe, expect, it } from "vitest";
import { checkContentLength, readBodyTextWithLimit } from "./request-size";

const MAX = 10 * 1024 * 1024;

describe("checkContentLength", () => {
  describe("dentro do teto", () => {
    it("aceita um corpo pequeno", () => {
      expect(checkContentLength("1024", MAX)).toEqual({ kind: "within-limit", bytes: 1024 });
    });

    it("aceita corpo vazio declarado", () => {
      expect(checkContentLength("0", MAX)).toEqual({ kind: "within-limit", bytes: 0 });
    });

    it("aceita exatamente o teto (limite é inclusivo)", () => {
      expect(checkContentLength(String(MAX), MAX)).toEqual({ kind: "within-limit", bytes: MAX });
    });

    it("tolera espaços em volta (OWS do HTTP)", () => {
      expect(checkContentLength("  2048  ", MAX)).toEqual({ kind: "within-limit", bytes: 2048 });
    });

    it("aceita zeros à esquerda (1*DIGIT continua sendo dígito)", () => {
      expect(checkContentLength("000512", MAX)).toEqual({ kind: "within-limit", bytes: 512 });
    });
  });

  describe("acima do teto", () => {
    it("recusa um byte além do teto", () => {
      expect(checkContentLength(String(MAX + 1), MAX)).toEqual({
        kind: "too-large",
        bytes: MAX + 1,
      });
    });

    it("recusa um corpo absurdo", () => {
      expect(checkContentLength("999999999", MAX)).toEqual({
        kind: "too-large",
        bytes: 999999999,
      });
    });

    it("recusa número maior que o inteiro seguro sem virar malformed", () => {
      const verdict = checkContentLength("9".repeat(30), MAX);
      expect(verdict.kind).toBe("too-large");
    });
  });

  describe("header ausente", () => {
    it("devolve unknown quando não veio (chunked usa isso)", () => {
      expect(checkContentLength(null, MAX)).toEqual({ kind: "unknown" });
    });

    it("devolve unknown para string vazia", () => {
      expect(checkContentLength("", MAX)).toEqual({ kind: "unknown" });
    });

    it("devolve unknown para header só com espaços", () => {
      expect(checkContentLength("   ", MAX)).toEqual({ kind: "unknown" });
    });

    it("unknown NÃO é liberação: nunca é within-limit", () => {
      // Documenta o contrato: quem chama precisa contar bytes na leitura.
      expect(checkContentLength(null, MAX).kind).not.toBe("within-limit");
    });
  });

  describe("header malformado", () => {
    it.each([
      ["negativo", "-1"],
      ["fracionário", "1.5"],
      ["notação científica", "1e6"],
      ["hexadecimal", "0x10"],
      ["com sinal de mais", "+10"],
      ["texto", "muitos"],
      ["número com sufixo", "100kb"],
      ["espaço no meio", "1 000"],
    ])("recusa %s", (_label, header) => {
      expect(checkContentLength(header, MAX)).toEqual({ kind: "malformed" });
    });

    it("recusa header DUPLICADO (Headers.get junta com vírgula) — sinal de smuggling", () => {
      expect(checkContentLength("10, 20", MAX)).toEqual({ kind: "malformed" });
    });

    it("recusa duplicata com valores iguais também", () => {
      expect(checkContentLength("10, 10", MAX)).toEqual({ kind: "malformed" });
    });
  });
});

/** Monta um Request real com corpo de N bytes (sem servidor). */
function requestWithBody(body: string): Request {
  return new Request("https://example.test/api/webhooks/erp", {
    method: "POST",
    body,
  });
}

describe("readBodyTextWithLimit", () => {
  it("lê um corpo dentro do teto", async () => {
    const result = await readBodyTextWithLimit(requestWithBody('{"event":"ping"}'), MAX);
    expect(result).toEqual({ ok: true, text: '{"event":"ping"}' });
  });

  it("devolve string vazia quando não há corpo", async () => {
    const request = new Request("https://example.test/api/webhooks/erp", { method: "GET" });
    await expect(readBodyTextWithLimit(request, MAX)).resolves.toEqual({ ok: true, text: "" });
  });

  it("recusa corpo maior que o teto, mesmo sem Content-Length confiável", async () => {
    const result = await readBodyTextWithLimit(requestWithBody("x".repeat(2048)), 1024);
    expect(result).toEqual({ ok: false, reason: "too-large" });
  });

  it("aceita corpo exatamente no teto", async () => {
    const result = await readBodyTextWithLimit(requestWithBody("x".repeat(1024)), 1024);
    expect(result).toEqual({ ok: true, text: "x".repeat(1024) });
  });

  it("conta BYTES, não caracteres (UTF-8 multibyte)", async () => {
    // "é" ocupa 2 bytes; 600 caracteres = 1200 bytes > teto de 1000.
    const result = await readBodyTextWithLimit(requestWithBody("é".repeat(600)), 1000);
    expect(result).toEqual({ ok: false, reason: "too-large" });
  });

  it("preserva UTF-8 multibyte na leitura bem-sucedida", async () => {
    const text = "acentuação e emoji 🚀";
    const result = await readBodyTextWithLimit(requestWithBody(text), MAX);
    expect(result).toEqual({ ok: true, text });
  });

  it("recusa um corpo em stream (chunked, sem Content-Length) acima do teto", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < 10; i++) {
          controller.enqueue(new Uint8Array(256));
        }
        controller.close();
      },
    });
    const request = new Request("https://example.test/api/webhooks/erp", {
      method: "POST",
      body: stream,
      // @ts-expect-error -- `duplex` é exigido pelo undici para corpo em stream.
      duplex: "half",
    });

    await expect(readBodyTextWithLimit(request, 1024)).resolves.toEqual({
      ok: false,
      reason: "too-large",
    });
  });
});
