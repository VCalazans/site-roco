import { describe, expect, it } from "vitest";
import {
  EMPTY_SOCIAL_LINKS,
  isCatalogLocation,
  isHttpUrl,
  isValidEmail,
  normalizePhone,
  parseSocialLinks,
  serializeSocialLinks,
} from "./site-settings-form";

describe("parseSocialLinks", () => {
  it("valor ausente ou vazio dá campos vazios sem avisar", () => {
    expect(parseSocialLinks(undefined)).toEqual({ values: EMPTY_SOCIAL_LINKS, invalid: false });
    expect(parseSocialLinks("  ")).toEqual({ values: EMPTY_SOCIAL_LINKS, invalid: false });
  });

  it("lê as quatro redes do JSON salvo", () => {
    const raw = JSON.stringify({
      instagram: "https://instagram.com/roco",
      linkedin: " https://linkedin.com/company/roco ",
      youtube: "https://youtube.com/@roco",
      whatsapp: "https://wa.me/554733352012",
    });
    expect(parseSocialLinks(raw)).toEqual({
      invalid: false,
      values: {
        instagram: "https://instagram.com/roco",
        linkedin: "https://linkedin.com/company/roco",
        youtube: "https://youtube.com/@roco",
        whatsapp: "https://wa.me/554733352012",
      },
    });
  });

  it("ignora chaves desconhecidas e valores que não são texto", () => {
    const parsed = parseSocialLinks(JSON.stringify({ instagram: 42, facebook: "https://fb.com/x" }));
    expect(parsed.values).toEqual(EMPTY_SOCIAL_LINKS);
    expect(parsed.invalid).toBe(false);
  });

  it("marca como inválido texto cru, array e JSON escalar (editor antigo aceitava tudo)", () => {
    expect(parseSocialLinks("isto não é json").invalid).toBe(true);
    expect(parseSocialLinks("[1,2]").invalid).toBe(true);
    expect(parseSocialLinks('"texto"').invalid).toBe(true);
    expect(parseSocialLinks("null").invalid).toBe(true);
  });
});

describe("serializeSocialLinks", () => {
  it("grava só as redes preenchidas, na ordem fixa", () => {
    expect(
      serializeSocialLinks({
        ...EMPTY_SOCIAL_LINKS,
        youtube: " https://youtube.com/@roco ",
        instagram: "https://instagram.com/roco",
      })
    ).toBe('{"instagram":"https://instagram.com/roco","youtube":"https://youtube.com/@roco"}');
  });

  it("tudo em branco vira {} (o servidor recusa string vazia)", () => {
    expect(serializeSocialLinks(EMPTY_SOCIAL_LINKS)).toBe("{}");
  });

  it("faz ida e volta com parseSocialLinks", () => {
    const values = {
      instagram: "https://instagram.com/roco",
      linkedin: "",
      youtube: "https://youtube.com/@roco",
      whatsapp: "https://wa.me/554733352012",
    };
    expect(parseSocialLinks(serializeSocialLinks(values)).values).toEqual(values);
  });
});

describe("isHttpUrl", () => {
  it("aceita http e https", () => {
    expect(isHttpUrl("https://www.instagram.com/roco")).toBe(true);
    expect(isHttpUrl("http://exemplo.com.br/x?y=1")).toBe(true);
  });

  it("rejeita outros esquemas, texto solto e espaços", () => {
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("ftp://exemplo.com")).toBe(false);
    expect(isHttpUrl("instagram.com/roco")).toBe(false);
    expect(isHttpUrl("https://exem plo.com")).toBe(false);
    expect(isHttpUrl("")).toBe(false);
  });
});

describe("isValidEmail", () => {
  it("valida o formato básico", () => {
    expect(isValidEmail("vendas@roco.com.br")).toBe(true);
    expect(isValidEmail("  vendas@roco.com.br ")).toBe(true);
    expect(isValidEmail("vendas@roco")).toBe(false);
    expect(isValidEmail("vendas roco.com.br")).toBe(false);
    expect(isValidEmail("@roco.com.br")).toBe(false);
  });
});

describe("normalizePhone", () => {
  it("devolve só os dígitos, com máscara ou sem", () => {
    expect(normalizePhone("554733352012")).toBe("554733352012");
    expect(normalizePhone("+55 (47) 3335-2012")).toBe("554733352012");
  });

  it("recusa números curtos ou longos demais", () => {
    expect(normalizePhone("3335-2012")).toBeNull();
    expect(normalizePhone("1".repeat(16))).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
});

describe("isCatalogLocation", () => {
  it("aceita URL http(s) e caminho iniciado por /", () => {
    expect(isCatalogLocation("https://cdn.roco.com.br/catalogo.pdf")).toBe(true);
    expect(isCatalogLocation("/downloads/catalogo-roco-2026.pdf")).toBe(true);
  });

  it("rejeita esquema perigoso, URL sem esquema e //host", () => {
    expect(isCatalogLocation("javascript:alert(1)")).toBe(false);
    expect(isCatalogLocation("//evil.com/catalogo.pdf")).toBe(false);
    expect(isCatalogLocation("catalogo.pdf")).toBe(false);
    expect(isCatalogLocation("/com espaço.pdf")).toBe(false);
    expect(isCatalogLocation("")).toBe(false);
  });
});
