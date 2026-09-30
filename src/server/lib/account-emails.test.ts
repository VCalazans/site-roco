import { describe, expect, it } from "vitest";
import pt from "@/i18n/dictionaries/pt.json";
import en from "@/i18n/dictionaries/en.json";
import { buildAccountEmail, escapeHtml, greetingName, type AccountEmailKind } from "./account-emails";

const LINK = "https://roco.com.br/pt/portal/redefinir-senha#token=abc_DEF-123";
const KINDS: AccountEmailKind[] = ["verifyEmail", "resetPassword", "passwordChanged"];

describe("buildAccountEmail", () => {
  it.each(KINDS)("%s: assunto, saudação, link no texto e no HTML", (kind) => {
    const email = buildAccountEmail(kind, pt.emails, { name: "Ana Souza", link: LINK });
    expect(email.subject).toBe(pt.emails[kind].subject);
    expect(email.text).toContain("Olá, Ana!");
    expect(email.text).toContain(LINK);
    expect(email.html).toContain(`href="${LINK}"`);
    expect(email.html).toContain(escapeHtml(pt.emails[kind].button));
  });

  it("sem nome, saudação genérica", () => {
    const email = buildAccountEmail("resetPassword", pt.emails, { name: "  ", link: LINK });
    expect(email.text.startsWith(pt.emails.greetingNoName)).toBe(true);
  });

  it("nada que vem de fora vira HTML: o nome perde tudo que não é letra e o link é escapado", () => {
    const email = buildAccountEmail("verifyEmail", pt.emails, {
      name: '<script>alert("x")</script>',
      link: 'https://roco.com.br/"><img src=x onerror=alert(1)>',
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<img");
    expect(email.text).toContain("Olá, scriptalertxscript!");
    expect(email.html).toContain("&quot;&gt;&lt;img");
  });

  it("frase de golpe no campo nome não chega ao e-mail", () => {
    const email = buildAccountEmail("verifyEmail", pt.emails, {
      name: "Sua conta será bloqueada. Ligue 0800 123 4567 ou acesse roco-suporte.xyz",
      link: LINK,
    });
    expect(email.text).toContain("Olá, Sua!");
    expect(email.text).not.toMatch(/0800|suporte|bloqueada/);
    expect(email.html).not.toMatch(/0800|suporte|bloqueada/);
  });

  it("inglês usa o dicionário em inglês", () => {
    const email = buildAccountEmail("verifyEmail", en.emails, { name: "Ann", link: LINK });
    expect(email.subject).toBe(en.emails.verifyEmail.subject);
    expect(email.text).toContain("Ann");
  });
});

describe("greetingName", () => {
  it("fica só com o primeiro nome, em letras (acento, apóstrofo e hífen valem)", () => {
    expect(greetingName("Maria d'Ávila Souza")).toBe("Maria");
    expect(greetingName("Jean-Luc Picard")).toBe("Jean-Luc");
    expect(greetingName("  João2026!  ")).toBe("João");
    expect(greetingName("www.golpe.com")).toBe("wwwgolpecom");
  });

  it("vazio ou só símbolos: sem nome (a saudação genérica assume)", () => {
    expect(greetingName(null)).toBe("");
    expect(greetingName("   ")).toBe("");
    expect(greetingName("0800-123")).toBe("");
    expect(greetingName("-Ana-")).toBe("Ana");
  });

  it("corta em 40 caracteres", () => {
    expect(greetingName("A".repeat(60))).toHaveLength(40);
  });
});
