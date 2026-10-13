import { describe, it, expect, vi, afterEach } from "vitest";
import { absoluteUrl, buildAlternates, siteUrl, LOCALE_LANGUAGE_TAGS } from "./metadata";

describe("metadata", () => {
  describe("absoluteUrl", () => {
    it("transforma caminho em URL no domínio canônico", () => {
      expect(absoluteUrl("/pt/produtos")).toBe(`${siteUrl}/pt/produtos`);
    });

    it("aceita caminho sem barra inicial", () => {
      expect(absoluteUrl("pt/produtos")).toBe(`${siteUrl}/pt/produtos`);
    });

    it("raiz vira siteUrl com barra", () => {
      expect(absoluteUrl("/")).toBe(`${siteUrl}/`);
    });

    it("URL já absoluta (http/https) é devolvida sem alteração", () => {
      expect(absoluteUrl("https://catalogo.roco.com.br/catalogo-roco")).toBe(
        "https://catalogo.roco.com.br/catalogo-roco"
      );
      expect(absoluteUrl("HTTP://exemplo.test/x")).toBe("HTTP://exemplo.test/x");
    });

    it("preserva querystring e fragmento", () => {
      expect(absoluteUrl("/pt/produtos?category=gas#topo")).toBe(`${siteUrl}/pt/produtos?category=gas#topo`);
    });
  });

  describe("buildAlternates", () => {
    it("canonical absoluto e hreflang pt-BR, en e x-default (português)", () => {
      expect(buildAlternates("pt", "/produtos")).toEqual({
        canonical: `${siteUrl}/pt/produtos`,
        languages: {
          "pt-BR": `${siteUrl}/pt/produtos`,
          en: `${siteUrl}/en/produtos`,
          "x-default": `${siteUrl}/pt/produtos`,
        },
      });
    });

    it("canonical do inglês aponta para /en mas as alternativas são as mesmas", () => {
      const alt = buildAlternates("en", "/produtos");
      expect(alt.canonical).toBe(`${siteUrl}/en/produtos`);
      expect(alt.languages).toEqual(buildAlternates("pt", "/produtos").languages);
    });

    it("sem caminho (home): canonical é só o locale", () => {
      const alt = buildAlternates("pt");
      expect(alt.canonical).toBe(`${siteUrl}/pt`);
      expect(alt.languages["pt-BR"]).toBe(`${siteUrl}/pt`);
      expect(alt.languages["x-default"]).toBe(`${siteUrl}/pt`);
    });

    it("caminho com querystring (sem barra) é preservado no canonical", () => {
      const alt = buildAlternates("pt", "?category=gas");
      expect(alt.canonical).toBe(`${siteUrl}/pt?category=gas`);
      expect(alt.languages.en).toBe(`${siteUrl}/en?category=gas`);
    });

    it("caminho sem barra inicial ganha a barra", () => {
      expect(buildAlternates("pt", "contato").canonical).toBe(`${siteUrl}/pt/contato`);
    });

    it("idiomas usam os códigos BCP 47 declarados", () => {
      expect(LOCALE_LANGUAGE_TAGS).toEqual({ pt: "pt-BR", en: "en" });
    });
  });

  describe("siteUrl (configuração por ambiente)", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.resetModules();
    });

    it("sem NEXT_PUBLIC_SITE_URL usa o domínio de produção", async () => {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
      vi.resetModules();
      const mod = await import("./metadata");
      expect(mod.siteUrl).toBe("https://roco.com.br");
    });

    it("remove barras finais e espaços da URL configurada", async () => {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "  https://homolog.exemplo.test//  ");
      vi.resetModules();
      const mod = await import("./metadata");
      expect(mod.siteUrl).toBe("https://homolog.exemplo.test");
      expect(mod.absoluteUrl("/pt")).toBe("https://homolog.exemplo.test/pt");
    });
  });
});
