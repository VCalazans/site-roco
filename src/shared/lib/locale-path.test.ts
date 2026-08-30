import { describe, expect, it } from "vitest";
import { alternateLocale, localeFromPath, switchLocalePath } from "./locale-path";

const LOCALES = ["pt", "en"] as const;

describe("switchLocalePath", () => {
  describe("casos obrigatórios do seletor de idioma", () => {
    it("troca a raiz do locale (/pt → /en)", () => {
      expect(switchLocalePath("/pt", "en", LOCALES)).toBe("/en");
      expect(switchLocalePath("/en", "pt", LOCALES)).toBe("/pt");
    });

    it("troca uma rota aninhada preservando todo o resto do caminho", () => {
      expect(switchLocalePath("/pt/produtos/valvula-caixa", "en", LOCALES)).toBe(
        "/en/produtos/valvula-caixa"
      );
    });

    it("preserva a querystring", () => {
      expect(
        switchLocalePath("/pt/produtos?search=torneira&page=2", "en", LOCALES)
      ).toBe("/en/produtos?search=torneira&page=2");
    });

    it("preserva o fragmento", () => {
      expect(switchLocalePath("/pt/contato#formulario", "en", LOCALES)).toBe(
        "/en/contato#formulario"
      );
    });

    it("preserva querystring E fragmento, nessa ordem", () => {
      expect(
        switchLocalePath("/pt/contato?assunto=quote&origem=menu#form", "en", LOCALES)
      ).toBe("/en/contato?assunto=quote&origem=menu#form");
    });

    it("é idempotente quando o caminho já está no locale de destino", () => {
      expect(switchLocalePath("/en/produtos?page=3", "en", LOCALES)).toBe(
        "/en/produtos?page=3"
      );
      expect(switchLocalePath("/en", "en", LOCALES)).toBe("/en");
    });

    it("PREFIXA um caminho sem locale nenhum em vez de comer o 1º segmento", () => {
      // O middleware normalmente redireciona antes, mas se o componente
      // renderizar num caminho cru, trocar `/contato` por `/en` mandaria a
      // pessoa para a home — perda silenciosa de destino.
      expect(switchLocalePath("/contato", "en", LOCALES)).toBe("/en/contato");
      expect(switchLocalePath("/produtos/valvula?page=2", "en", LOCALES)).toBe(
        "/en/produtos/valvula?page=2"
      );
    });
  });

  describe("bordas", () => {
    it("a raiz nua vira a raiz do locale, sem barra sobrando", () => {
      expect(switchLocalePath("/", "en", LOCALES)).toBe("/en");
      expect(switchLocalePath("/?utm_source=google", "en", LOCALES)).toBe(
        "/en?utm_source=google"
      );
    });

    it("string vazia vira /{locale} (nunca um caminho relativo)", () => {
      expect(switchLocalePath("", "en", LOCALES)).toBe("/en");
    });

    it("caminho sem barra inicial é normalizado para absoluto, sem perder o destino", () => {
      expect(switchLocalePath("produtos", "en", LOCALES)).toBe("/en/produtos");
      expect(switchLocalePath("pt/produtos", "en", LOCALES)).toBe("/en/produtos");
    });

    it("preserva a barra final quando ela existe", () => {
      expect(switchLocalePath("/pt/", "en", LOCALES)).toBe("/en/");
    });

    it("não confunde um segmento que apenas COMEÇA com o locale", () => {
      expect(switchLocalePath("/ptbr/produtos", "en", LOCALES)).toBe(
        "/en/ptbr/produtos"
      );
    });

    it("só troca o PRIMEIRO segmento, mesmo quando o locale reaparece adiante", () => {
      expect(switchLocalePath("/pt/produtos/pt", "en", LOCALES)).toBe(
        "/en/produtos/pt"
      );
    });

    it("não trata rota do portal de forma especial", () => {
      expect(switchLocalePath("/pt/portal/login?callbackUrl=%2Fpt%2Fportal", "en", LOCALES)).toBe(
        "/en/portal/login?callbackUrl=%2Fpt%2Fportal"
      );
    });

    it("aceita um fragmento sem querystring e vice-versa", () => {
      expect(switchLocalePath("/pt#topo", "en", LOCALES)).toBe("/en#topo");
      expect(switchLocalePath("/pt?a=1", "en", LOCALES)).toBe("/en?a=1");
    });

    it("trata '#' antes de '?' como fragmento inteiro (a cauda é opaca)", () => {
      expect(switchLocalePath("/pt/produtos#x?y=1", "en", LOCALES)).toBe(
        "/en/produtos#x?y=1"
      );
    });
  });
});

describe("localeFromPath", () => {
  it("reconhece o locale do primeiro segmento", () => {
    expect(localeFromPath("/pt/produtos", LOCALES)).toBe("pt");
    expect(localeFromPath("/en", LOCALES)).toBe("en");
  });

  it("devolve null quando não há prefixo de locale", () => {
    expect(localeFromPath("/", LOCALES)).toBeNull();
    expect(localeFromPath("/contato", LOCALES)).toBeNull();
    expect(localeFromPath("", LOCALES)).toBeNull();
  });

  it("ignora querystring e fragmento", () => {
    expect(localeFromPath("/pt?utm_source=x", LOCALES)).toBe("pt");
    expect(localeFromPath("/en#topo", LOCALES)).toBe("en");
  });
});

describe("alternateLocale", () => {
  it("devolve o outro idioma do par", () => {
    expect(alternateLocale("pt", LOCALES)).toBe("en");
    expect(alternateLocale("en", LOCALES)).toBe("pt");
  });

  it("devolve o próprio quando só há um locale (UI fica inerte)", () => {
    expect(alternateLocale("pt", ["pt"] as const)).toBe("pt");
  });

  it("devolve o primeiro diferente quando o locale atual é desconhecido", () => {
    expect(alternateLocale("es", LOCALES)).toBe("pt");
  });
});
