import { describe, expect, it } from "vitest";
import {
  EMPTY_SOCIAL_LINKS,
  isCatalogLocation,
  isHttpUrl,
  isValidEmail,
  normalizePhone,
  normalizeSocialLink,
  normalizeWhatsappNumber,
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

describe("normalizeSocialLink — aceita o que o operador souber digitar", () => {
  const ok = (url: string) => ({ kind: "ok", url });
  const err = (reason: string) => ({ kind: "error", reason });

  it("vazio é vazio (a rede some do rodapé)", () => {
    expect(normalizeSocialLink("instagram", "   ")).toEqual({ kind: "empty" });
  });

  it("Instagram: @perfil, perfil, link com ou sem https/www — sempre o link canônico", () => {
    for (const input of ["@rocoindustria", "rocoindustria", "instagram.com/rocoindustria", "www.instagram.com/rocoindustria/", "https://www.instagram.com/rocoindustria/?hl=pt-br"]) {
      expect(normalizeSocialLink("instagram", input)).toEqual(ok("https://www.instagram.com/rocoindustria"));
    }
    expect(normalizeSocialLink("instagram", "roco.oficial")).toEqual(ok("https://www.instagram.com/roco.oficial"));
  });

  it("YouTube: @canal vira youtube.com/@canal; links de canal são preservados", () => {
    expect(normalizeSocialLink("youtube", "@rocoindustria")).toEqual(ok("https://www.youtube.com/@rocoindustria"));
    expect(normalizeSocialLink("youtube", "youtube.com/@rocoindustria")).toEqual(ok("https://www.youtube.com/@rocoindustria"));
    expect(normalizeSocialLink("youtube", "https://m.youtube.com/channel/UC123")).toEqual(ok("https://www.youtube.com/channel/UC123"));
    expect(normalizeSocialLink("youtube", "https://youtu.be/abc")).toEqual(ok("https://youtu.be/abc"));
  });

  it("LinkedIn: nome da página, company/..., link com subdomínio de país", () => {
    expect(normalizeSocialLink("linkedin", "roco-industria")).toEqual(ok("https://www.linkedin.com/company/roco-industria"));
    expect(normalizeSocialLink("linkedin", "company/roco-industria/")).toEqual(ok("https://www.linkedin.com/company/roco-industria"));
    expect(normalizeSocialLink("linkedin", "https://br.linkedin.com/company/roco-industria?trk=x")).toEqual(
      ok("https://www.linkedin.com/company/roco-industria")
    );
  });

  it("WhatsApp: número com máscara, com ou sem DDI, e links wa.me/api.whatsapp.com", () => {
    for (const input of ["(47) 3335-2012", "47 3335 2012", "+55 47 3335-2012", "047 3335-2012", "wa.me/554733352012", "https://api.whatsapp.com/send?phone=554733352012&text=Oi"]) {
      expect(normalizeSocialLink("whatsapp", input)).toEqual(ok("https://wa.me/554733352012"));
    }
    expect(normalizeSocialLink("whatsapp", "(47) 99999-8888")).toEqual(ok("https://wa.me/5547999998888"));
    // link curto do WhatsApp Business fica como está
    expect(normalizeSocialLink("whatsapp", "https://wa.me/message/ABC123")).toEqual(ok("https://wa.me/message/ABC123"));
  });

  it("link de OUTRA rede no campo errado é recusado", () => {
    expect(normalizeSocialLink("instagram", "https://facebook.com/roco")).toEqual(err("wrongNetwork"));
    expect(normalizeSocialLink("linkedin", "instagram.com/roco")).toEqual(err("wrongNetwork"));
    expect(normalizeSocialLink("whatsapp", "https://t.me/roco")).toEqual(err("wrongNetwork"));
  });

  it("entradas inválidas dizem o motivo", () => {
    expect(normalizeSocialLink("instagram", "instagram.com")).toEqual(err("invalid"));
    expect(normalizeSocialLink("instagram", "meu perfil")).toEqual(err("invalid"));
    expect(normalizeSocialLink("instagram", "javascript:alert(1)")).toEqual(err("invalid"));
    expect(normalizeSocialLink("youtube", "@ab")).toEqual(err("invalid"));
    expect(normalizeSocialLink("whatsapp", "123")).toEqual(err("invalidPhone"));
    expect(normalizeSocialLink("whatsapp", "whatsapp")).toEqual(err("invalidPhone"));
    expect(normalizeSocialLink("instagram", "https://instagram.com/" + "a".repeat(400))).toEqual(err("tooLong"));
  });
});

describe("normalizeWhatsappNumber", () => {
  it("DDD + número ganha o 55; com DDI fica como está; curto demais é recusado", () => {
    expect(normalizeWhatsappNumber("4733352012")).toBe("554733352012");
    expect(normalizeWhatsappNumber("47999998888")).toBe("5547999998888");
    expect(normalizeWhatsappNumber("+1 (415) 555-2671 00")).toBe("141555526710" + "0");
    expect(normalizeWhatsappNumber("12345")).toBeNull();
  });
});
