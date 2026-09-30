import { describe, expect, it } from "vitest";
import {
  HONEYPOT_FIELD,
  isUnconfirmedPreRegistration,
  isValidPersonName,
  normalizePersonName,
  PERSON_NAME_MAX,
  REGISTER_PASSWORD_MIN,
  registerSchema,
} from "./representative-register";

/** CNPJ numérico válido (dígitos verificadores corretos). */
const VALID_CNPJ = "11.222.333/0001-81";

const VALID_INPUT = {
  name: "Maria Representante",
  email: "MARIA@exemplo.com.br",
  phone: "(47) 99999-1234",
  companyName: "Representações Maria LTDA",
  cnpj: VALID_CNPJ,
  password: "senha-segura-1",
};

describe("registerSchema", () => {
  it("aceita input completo válido e normaliza o e-mail para minúsculas", () => {
    const parsed = registerSchema.parse(VALID_INPUT);
    expect(parsed.email).toBe("maria@exemplo.com.br");
    expect(parsed.cnpj).toBe(VALID_CNPJ);
  });

  it("rejeita CNPJ ausente", () => {
    const result = registerSchema.safeParse({ ...VALID_INPUT, cnpj: "" });
    expect(result.success).toBe(false);
  });

  it("rejeita CNPJ com dígito verificador errado", () => {
    const result = registerSchema.safeParse({
      ...VALID_INPUT,
      cnpj: "11.222.333/0001-80",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita CNPJ de caracteres repetidos", () => {
    const result = registerSchema.safeParse({
      ...VALID_INPUT,
      cnpj: "00.000.000/0000-00",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita e-mail inválido", () => {
    const result = registerSchema.safeParse({ ...VALID_INPUT, email: "nao-eh-email" });
    expect(result.success).toBe(false);
  });

  it("rejeita telefone fora do padrão BR", () => {
    const result = registerSchema.safeParse({ ...VALID_INPUT, phone: "12345" });
    expect(result.success).toBe(false);
  });

  it("aceita telefone fixo (10 dígitos) e celular (11 dígitos)", () => {
    expect(
      registerSchema.safeParse({ ...VALID_INPUT, phone: "(47) 3333-2012" }).success
    ).toBe(true);
    expect(
      registerSchema.safeParse({ ...VALID_INPUT, phone: "(47) 99999-1234" }).success
    ).toBe(true);
  });

  it(`rejeita senha com menos de ${REGISTER_PASSWORD_MIN} caracteres`, () => {
    const result = registerSchema.safeParse({
      ...VALID_INPUT,
      password: "1234567",
    });
    expect(result.success).toBe(false);
  });

  it("aplica a política de senha compartilhada: comum ou com o e-mail é recusada", () => {
    const common = registerSchema.safeParse({ ...VALID_INPUT, password: "senha123" });
    expect(common.success).toBe(false);
    expect(common.error?.issues[0]).toMatchObject({ path: ["password"], message: "too_common" });

    // E-mail "MARIA@exemplo.com.br": a senha não pode conter "maria".
    const withEmail = registerSchema.safeParse({ ...VALID_INPUT, password: "Maria-2026-vendas" });
    expect(withEmail.error?.issues[0]).toMatchObject({ path: ["password"], message: "contains_email" });
  });

  it("aceita o idioma da página (o e-mail de confirmação sai nele) e recusa outro", () => {
    expect(registerSchema.parse({ ...VALID_INPUT, locale: "en" }).locale).toBe("en");
    expect(registerSchema.safeParse({ ...VALID_INPUT, locale: "es" }).success).toBe(false);
  });

  it("nome só com letras (acento, espaço, apóstrofo, ponto e hífen) e espaços normalizados", () => {
    expect(registerSchema.parse({ ...VALID_INPUT, name: "  Maria  d'Ávila\n Souza Jr. " }).name).toBe(
      "Maria d'Ávila Souza Jr."
    );
    expect(registerSchema.safeParse({ ...VALID_INPUT, name: "Ana-Luísa Øster" }).success).toBe(true);
    for (const name of ["Ligue 0800 123 4567", "acesse roco-suporte.xyz/entrar", "maria@empresa.com", "João 2"]) {
      const result = registerSchema.safeParse({ ...VALID_INPUT, name });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]).toMatchObject({ path: ["name"], message: "invalid_name" });
    }
    expect(isValidPersonName("A".repeat(PERSON_NAME_MAX))).toBe(true);
    expect(isValidPersonName("A".repeat(PERSON_NAME_MAX + 1))).toBe(false);
    expect(normalizePersonName("  a \t b  ")).toBe("a b");
  });

  it("rejeita nome/razão social vazios ou curtos demais", () => {
    expect(registerSchema.safeParse({ ...VALID_INPUT, name: "A" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...VALID_INPUT, companyName: "" }).success).toBe(false);
  });

  it("expõe o nome do campo honeypot usado pela rota e pelo form", () => {
    expect(HONEYPOT_FIELD).toBe("website");
  });
});

describe("isUnconfirmedPreRegistration", () => {
  /** Pré-cadastro do site recém-criado, com o link de confirmação ainda sem clique. */
  const UNCONFIRMED = {
    emailVerified: false,
    hasPassword: true,
    hasOAuthAccount: false,
    hasRoles: false,
    status: "draft",
    submitted: false,
  };

  it("pré-cadastro que ainda não confirmou o e-mail não segura o CNPJ", () => {
    expect(isUnconfirmedPreRegistration(UNCONFIRMED)).toBe(true);
  });

  it("mantém o CNPJ de conta que confirmou o e-mail ou passou do rascunho", () => {
    expect(isUnconfirmedPreRegistration({ ...UNCONFIRMED, emailVerified: true })).toBe(false);
    expect(isUnconfirmedPreRegistration({ ...UNCONFIRMED, status: "submitted", submitted: true })).toBe(false);
    expect(isUnconfirmedPreRegistration({ ...UNCONFIRMED, status: "approved" })).toBe(false);
    expect(isUnconfirmedPreRegistration({ ...UNCONFIRMED, submitted: true })).toBe(false);
  });

  it("mantém contas com login social, com perfil concedido ou sem senha", () => {
    expect(isUnconfirmedPreRegistration({ ...UNCONFIRMED, hasOAuthAccount: true })).toBe(false);
    expect(isUnconfirmedPreRegistration({ ...UNCONFIRMED, hasRoles: true })).toBe(false);
    expect(isUnconfirmedPreRegistration({ ...UNCONFIRMED, hasPassword: false })).toBe(false);
  });
});
