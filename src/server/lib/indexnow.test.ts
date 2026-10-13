import { describe, it, expect, vi, afterEach } from "vitest";

// `next/server` só é usado por `submitToIndexNow` (fora do escopo destes testes puros).
vi.mock("next/server", () => ({ after: vi.fn() }));

import { siteUrl, absoluteUrl } from "@/core/config/metadata";
import { buildIndexNowPayload, getIndexNowKey, productUrls } from "./indexnow";

const HOST = new URL(siteUrl).host;

describe("indexnow", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete process.env.INDEXNOW_KEY;
  });

  describe("getIndexNowKey", () => {
    it("sem INDEXNOW_KEY devolve null (módulo desligado)", () => {
      delete process.env.INDEXNOW_KEY;
      expect(getIndexNowKey()).toBeNull();
    });

    it("chave válida (8 a 128 caracteres alfanuméricos e hífen) é devolvida", () => {
      vi.stubEnv("INDEXNOW_KEY", "abcdef12-XYZ");
      expect(getIndexNowKey()).toBe("abcdef12-XYZ");
    });

    it("espaços em volta são ignorados", () => {
      vi.stubEnv("INDEXNOW_KEY", "  abcdef1234  \n");
      expect(getIndexNowKey()).toBe("abcdef1234");
    });

    it("chave curta (menos de 8) é recusada", () => {
      vi.stubEnv("INDEXNOW_KEY", "abc1234");
      expect(getIndexNowKey()).toBeNull();
    });

    it("chave com caractere fora do padrão é recusada", () => {
      vi.stubEnv("INDEXNOW_KEY", "abcdef12_XYZ");
      expect(getIndexNowKey()).toBeNull();
      vi.stubEnv("INDEXNOW_KEY", "abcdef12 34");
      expect(getIndexNowKey()).toBeNull();
    });

    it("chave acima de 128 caracteres é recusada", () => {
      vi.stubEnv("INDEXNOW_KEY", "a".repeat(129));
      expect(getIndexNowKey()).toBeNull();
      vi.stubEnv("INDEXNOW_KEY", "a".repeat(128));
      expect(getIndexNowKey()).toBe("a".repeat(128));
    });
  });

  describe("buildIndexNowPayload", () => {
    const KEY = "abcdef1234";

    it("monta host, chave e keyLocation absoluto", () => {
      const payload = buildIndexNowPayload([absoluteUrl("/pt/produtos")], KEY);
      expect(payload).toEqual({
        host: HOST,
        key: KEY,
        keyLocation: absoluteUrl("/indexnow.txt"),
        urlList: [absoluteUrl("/pt/produtos")],
      });
    });

    it("descarta URLs de outro host (o IndexNow recusaria o lote inteiro)", () => {
      const payload = buildIndexNowPayload(
        [absoluteUrl("/pt/produtos"), "https://outro-site.test/pt/produtos"],
        KEY
      );
      expect(payload.urlList).toEqual([absoluteUrl("/pt/produtos")]);
    });

    it("descarta entradas que não são URL", () => {
      const payload = buildIndexNowPayload([absoluteUrl("/pt"), "não é url", ""], KEY);
      expect(payload.urlList).toEqual([absoluteUrl("/pt")]);
    });

    it("remove duplicadas mantendo a primeira ocorrência", () => {
      const url = absoluteUrl("/en/produtos/x");
      const payload = buildIndexNowPayload([url, absoluteUrl("/pt/x"), url], KEY);
      expect(payload.urlList).toEqual([url, absoluteUrl("/pt/x")]);
    });

    it("lista vazia gera urlList vazia", () => {
      expect(buildIndexNowPayload([], KEY).urlList).toEqual([]);
    });

    it("limita a 10.000 URLs por envio", () => {
      const urls = Array.from({ length: 10_050 }, (_, i) => absoluteUrl(`/pt/produtos/p-${i}`));
      expect(buildIndexNowPayload(urls, KEY).urlList).toHaveLength(10_000);
    });
  });

  describe("productUrls", () => {
    it("devolve a URL do produto nos dois idiomas", () => {
      expect(productUrls("flexivel-gas")).toEqual([
        absoluteUrl("/pt/produtos/flexivel-gas"),
        absoluteUrl("/en/produtos/flexivel-gas"),
      ]);
    });

    it("encoda o slug na URL", () => {
      const [pt] = productUrls("gás & cia");
      expect(pt).toBe(absoluteUrl("/pt/produtos/g%C3%A1s%20%26%20cia"));
    });
  });
});
