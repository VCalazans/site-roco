import { describe, it, expect } from "vitest";
import {
  LEAD_ORIGINS,
  LEAD_ORIGIN_PARAM,
  UTM_PARAMS,
  UTM_MAX_LENGTH,
  captureUtm,
  normalizeLeadOrigin,
  normalizeUtmValue,
  readUtmCookie,
  serializeUtmCookie,
  withLeadOrigin,
} from "./lead-origin";

describe("lead-origin", () => {
  describe("constants", () => {
    it("uses 'origem' as the query parameter name", () => {
      expect(LEAD_ORIGIN_PARAM).toBe("origem");
    });

    it("exposes the closed list of site sections", () => {
      expect(LEAD_ORIGINS).toEqual([
        "home-hero",
        "home-sobre",
        "home-categorias",
        "home-destaques",
        "home-portal",
        "produtos-listagem",
        "produto-detalhe",
        "catalogo",
        "menu",
        "rodape",
      ]);
    });

    it("has no duplicate origins", () => {
      expect(new Set(LEAD_ORIGINS).size).toBe(LEAD_ORIGINS.length);
    });

    it("exposes the three standard UTM params", () => {
      expect(UTM_PARAMS).toEqual(["utm_source", "utm_medium", "utm_campaign"]);
    });

    it("caps UTM values at 120 characters", () => {
      expect(UTM_MAX_LENGTH).toBe(120);
    });
  });

  describe("normalizeLeadOrigin", () => {
    it.each(LEAD_ORIGINS)("accepts the valid origin '%s'", (origin) => {
      expect(normalizeLeadOrigin(origin)).toBe(origin);
    });

    it("trims surrounding whitespace", () => {
      expect(normalizeLeadOrigin("  menu  ")).toBe("menu");
    });

    it("rejects a value outside the closed list", () => {
      expect(normalizeLeadOrigin("qualquer-coisa")).toBeUndefined();
    });

    it("rejects a value the visitor typed into the URL", () => {
      expect(normalizeLeadOrigin("<script>alert(1)</script>")).toBeUndefined();
    });

    it("is case sensitive (never guesses)", () => {
      expect(normalizeLeadOrigin("MENU")).toBeUndefined();
      expect(normalizeLeadOrigin("Home-Hero")).toBeUndefined();
    });

    it("rejects an empty string", () => {
      expect(normalizeLeadOrigin("")).toBeUndefined();
      expect(normalizeLeadOrigin("   ")).toBeUndefined();
    });

    it("rejects non-string values", () => {
      expect(normalizeLeadOrigin(undefined)).toBeUndefined();
      expect(normalizeLeadOrigin(null)).toBeUndefined();
      expect(normalizeLeadOrigin(42)).toBeUndefined();
      expect(normalizeLeadOrigin(["menu"])).toBeUndefined();
      expect(normalizeLeadOrigin({ origem: "menu" })).toBeUndefined();
      expect(normalizeLeadOrigin(true)).toBeUndefined();
    });

    it("rejects a valid origin with an injected suffix", () => {
      expect(normalizeLeadOrigin("menu&admin=1")).toBeUndefined();
      expect(normalizeLeadOrigin("menu\nX-Injected: 1")).toBeUndefined();
    });

    it("never throws on odd input", () => {
      expect(() => normalizeLeadOrigin("%%%")).not.toThrow();
      expect(normalizeLeadOrigin("%E0%A4%A")).toBeUndefined();
    });
  });

  describe("normalizeUtmValue", () => {
    it("keeps a normal campaign value", () => {
      expect(normalizeUtmValue("google")).toBe("google");
      expect(normalizeUtmValue("cpc")).toBe("cpc");
      expect(normalizeUtmValue("lancamento-catalogo-2026")).toBe("lancamento-catalogo-2026");
    });

    it("trims surrounding whitespace", () => {
      expect(normalizeUtmValue("  newsletter  ")).toBe("newsletter");
    });

    it("drops empty and whitespace-only values", () => {
      expect(normalizeUtmValue("")).toBeUndefined();
      expect(normalizeUtmValue("   ")).toBeUndefined();
    });

    it("drops non-string values", () => {
      expect(normalizeUtmValue(undefined)).toBeUndefined();
      expect(normalizeUtmValue(null)).toBeUndefined();
      expect(normalizeUtmValue(123)).toBeUndefined();
      expect(normalizeUtmValue(["google"])).toBeUndefined();
    });

    it("drops values carrying a carriage return (header injection)", () => {
      expect(normalizeUtmValue("google\r\nBcc: alvo@exemplo.com")).toBeUndefined();
    });

    it("drops values carrying a line feed", () => {
      expect(normalizeUtmValue("news\nletter")).toBeUndefined();
    });

    it("drops values carrying a NUL byte", () => {
      expect(normalizeUtmValue("google\0")).toBeUndefined();
    });

    it("truncates at the 120 character cap", () => {
      const long = "a".repeat(500);
      expect(normalizeUtmValue(long)).toHaveLength(UTM_MAX_LENGTH);
    });

    it("keeps a value exactly at the cap", () => {
      const exact = "b".repeat(UTM_MAX_LENGTH);
      expect(normalizeUtmValue(exact)).toBe(exact);
    });

    it("counts the cap AFTER trimming", () => {
      const padded = `   ${"c".repeat(UTM_MAX_LENGTH)}   `;
      expect(normalizeUtmValue(padded)).toHaveLength(UTM_MAX_LENGTH);
    });

    it("keeps accented and symbol-bearing campaign names", () => {
      expect(normalizeUtmValue("promoção-verão")).toBe("promoção-verão");
      expect(normalizeUtmValue("e-mail_mkt (base fria)")).toBe("e-mail_mkt (base fria)");
    });
  });

  describe("withLeadOrigin", () => {
    it("appends the param with '?' when there is no querystring", () => {
      expect(withLeadOrigin("/pt/contato", "menu")).toBe("/pt/contato?origem=menu");
    });

    it("appends with '&' when a querystring already exists", () => {
      expect(withLeadOrigin("/pt/contato?produto=valvula&assunto=quote", "produto-detalhe")).toBe(
        "/pt/contato?produto=valvula&assunto=quote&origem=produto-detalhe"
      );
    });

    it("appends with '&' to a single existing param", () => {
      expect(withLeadOrigin("/pt/catalogo?utm_source=google", "rodape")).toBe(
        "/pt/catalogo?utm_source=google&origem=rodape"
      );
    });

    it("returns the href untouched when the origin is missing", () => {
      expect(withLeadOrigin("/pt/contato", undefined)).toBe("/pt/contato");
      expect(withLeadOrigin("/pt/contato", null)).toBe("/pt/contato");
    });

    it("returns the href untouched when the origin is not in the closed list", () => {
      // Chamada vinda de JS não tipado / dado de banco.
      expect(withLeadOrigin("/pt/contato", "inventada" as never)).toBe("/pt/contato");
    });

    it("does not duplicate an origin that is already there", () => {
      expect(withLeadOrigin("/pt/contato?origem=menu", "rodape")).toBe("/pt/contato?origem=menu");
    });

    it("does not duplicate an origin that is already there among other params", () => {
      expect(withLeadOrigin("/pt/contato?assunto=quote&origem=menu", "rodape")).toBe(
        "/pt/contato?assunto=quote&origem=menu"
      );
    });

    it("still appends when another param merely ENDS with the param name", () => {
      // `x_origem` não é `origem` — não pode ser confundido.
      expect(withLeadOrigin("/pt/contato?x_origem=abc", "menu")).toBe(
        "/pt/contato?x_origem=abc&origem=menu"
      );
    });

    it("keeps the fragment at the end", () => {
      expect(withLeadOrigin("/pt/contato#form", "menu")).toBe("/pt/contato?origem=menu#form");
    });

    it("keeps the fragment at the end when there is already a querystring", () => {
      expect(withLeadOrigin("/pt/contato?assunto=quote#form", "menu")).toBe(
        "/pt/contato?assunto=quote&origem=menu#form"
      );
    });

    it("leaves a bare fragment untouched (no path to hang a query on)", () => {
      expect(withLeadOrigin("#catalogo", "menu")).toBe("#catalogo");
      expect(withLeadOrigin("#form", "rodape")).toBe("#form");
    });

    it("leaves an empty href untouched", () => {
      expect(withLeadOrigin("", "menu")).toBe("");
    });

    it("works on absolute URLs (the caller decides whether it should)", () => {
      expect(withLeadOrigin("https://roco.com.br/pt/contato", "menu")).toBe(
        "https://roco.com.br/pt/contato?origem=menu"
      );
    });

    it("never throws on malformed percent-encoding in the querystring", () => {
      expect(() => withLeadOrigin("/pt/contato?produto=%E0%A4%A", "menu")).not.toThrow();
      expect(withLeadOrigin("/pt/contato?produto=%E0%A4%A", "menu")).toBe(
        "/pt/contato?produto=%E0%A4%A&origem=menu"
      );
    });

    it("is idempotent", () => {
      const once = withLeadOrigin("/pt/contato", "menu");
      expect(withLeadOrigin(once, "menu")).toBe(once);
    });

    it("produces a param the URLSearchParams parser reads back", () => {
      const href = withLeadOrigin("/pt/contato?produto=valvula", "produto-detalhe");
      const query = new URLSearchParams(href.slice(href.indexOf("?")));
      expect(query.get(LEAD_ORIGIN_PARAM)).toBe("produto-detalhe");
      expect(query.get("produto")).toBe("valvula");
    });

    it.each(LEAD_ORIGINS)("round-trips origin '%s' through normalizeLeadOrigin", (origin) => {
      const href = withLeadOrigin("/pt/contato", origin);
      const query = new URLSearchParams(href.slice(href.indexOf("?")));
      expect(normalizeLeadOrigin(query.get(LEAD_ORIGIN_PARAM))).toBe(origin);
    });
  });
});

describe("captureUtm / readUtmCookie / serializeUtmCookie", () => {
  const fromMap = (map: Record<string, unknown>) => (param: string) => map[param];

  describe("captureUtm", () => {
    it("captura os três parâmetros de campanha", () => {
      expect(
        captureUtm(
          fromMap({
            utm_source: "google",
            utm_medium: "cpc",
            utm_campaign: "catalogo-2026",
          })
        )
      ).toEqual({
        utm_source: "google",
        utm_medium: "cpc",
        utm_campaign: "catalogo-2026",
      });
    });

    it("captura só o que existe (campanha parcial é comum)", () => {
      expect(captureUtm(fromMap({ utm_source: "newsletter" }))).toEqual({
        utm_source: "newsletter",
      });
    });

    it("devolve vazio quando não há campanha nenhuma", () => {
      expect(captureUtm(fromMap({}))).toEqual({});
    });

    it("ignora parâmetros fora da lista (nunca vira coletor genérico de URL)", () => {
      expect(captureUtm(fromMap({ utm_term: "x", gclid: "y", origem: "menu" }))).toEqual({});
    });

    it("aplica o mesmo saneamento da querystring (controle, teto, trim)", () => {
      expect(
        captureUtm(
          fromMap({
            utm_source: "  google  ",
            utm_medium: "cpc\r\nBcc: alvo@exemplo.com",
            utm_campaign: "z".repeat(500),
          })
        )
      ).toEqual({ utm_source: "google", utm_campaign: "z".repeat(UTM_MAX_LENGTH) });
    });

    it("aceita a assinatura de URLSearchParams.get (devolve null)", () => {
      const query = new URLSearchParams("utm_source=rd&outro=1");
      expect(captureUtm((param) => query.get(param))).toEqual({ utm_source: "rd" });
    });
  });

  describe("serializeUtmCookie", () => {
    it("devolve null quando não há campanha (não apaga a anterior)", () => {
      expect(serializeUtmCookie({})).toBeNull();
    });

    it("serializa uma campanha capturada", () => {
      expect(serializeUtmCookie({ utm_source: "google" })).toBe('{"utm_source":"google"}');
    });
  });

  describe("readUtmCookie", () => {
    it("faz o round-trip com serializeUtmCookie", () => {
      const captured = captureUtm(
        fromMap({ utm_source: "google", utm_medium: "cpc", utm_campaign: "verao" })
      );
      const serialized = serializeUtmCookie(captured);
      expect(readUtmCookie(serialized)).toEqual(captured);
    });

    it("devolve vazio para cookie ausente ou vazio", () => {
      expect(readUtmCookie(undefined)).toEqual({});
      expect(readUtmCookie(null)).toEqual({});
      expect(readUtmCookie("")).toEqual({});
    });

    it("nunca lança com JSON corrompido/truncado", () => {
      expect(() => readUtmCookie('{"utm_source":')).not.toThrow();
      expect(readUtmCookie('{"utm_source":')).toEqual({});
      expect(readUtmCookie("não é json")).toEqual({});
    });

    it("descarta JSON que não é objeto", () => {
      expect(readUtmCookie('"google"')).toEqual({});
      expect(readUtmCookie("42")).toEqual({});
      expect(readUtmCookie("null")).toEqual({});
      expect(readUtmCookie('["utm_source"]')).toEqual({});
    });

    it("sanea o conteúdo do cookie (é entrada tão suspeita quanto a URL)", () => {
      // Controle ESCAPADO no JSON: o parse funciona e o campo é descartado
      // pelo mesmo saneamento aplicado à querystring.
      const forged = JSON.stringify({ utm_source: "a\r\nX: 1", utm_medium: "cpc" });
      expect(readUtmCookie(forged)).toEqual({ utm_medium: "cpc" });
    });

    it("descarta cookie com caractere de controle CRU (JSON inválido)", () => {
      expect(readUtmCookie('{"utm_source":"a\r\nX: 1"}')).toEqual({});
    });

    it("ignora chaves extras injetadas no cookie", () => {
      expect(readUtmCookie('{"utm_source":"rd","admin":true,"__proto__":{"x":1}}')).toEqual({
        utm_source: "rd",
      });
    });

    it("descarta valores que não são string", () => {
      expect(readUtmCookie('{"utm_source":1,"utm_medium":{"a":1},"utm_campaign":"ok"}')).toEqual({
        utm_campaign: "ok",
      });
    });
  });
});
