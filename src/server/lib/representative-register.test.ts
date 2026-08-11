import { describe, expect, it } from "vitest";
import {
  HONEYPOT_FIELD,
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

  it("rejeita nome/razão social vazios ou curtos demais", () => {
    expect(registerSchema.safeParse({ ...VALID_INPUT, name: "A" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...VALID_INPUT, companyName: "" }).success).toBe(false);
  });

  it("expõe o nome do campo honeypot usado pela rota e pelo form", () => {
    expect(HONEYPOT_FIELD).toBe("website");
  });
});
