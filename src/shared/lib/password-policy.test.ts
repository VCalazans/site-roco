import { describe, expect, it } from "vitest";
import { checkPassword, PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH } from "./password-policy";

describe("checkPassword", () => {
  it("aceita uma frase comum de uso real", () => {
    expect(checkPassword("valvula de gaveta azul")).toBeNull();
    expect(checkPassword("Representante@Sul2026", { email: "joao.silva@empresa.com" })).toBeNull();
  });

  it(`exige ao menos ${PASSWORD_MIN_LENGTH} caracteres (contando acentos como 1)`, () => {
    expect(checkPassword("curta")).toBe("too_short");
    expect(checkPassword("çãéíõúâ")).toBe("too_short");
    expect(checkPassword("çãéíõúâê")).toBeNull();
  });

  it(`recusa mais de ${PASSWORD_MAX_BYTES} bytes (o bcrypt ignoraria o resto)`, () => {
    expect(checkPassword("a".repeat(71) + "b")).toBeNull();
    expect(checkPassword("a".repeat(72) + "b")).toBe("too_long");
    // 37 caracteres acentuados = 74 bytes em UTF-8
    expect(checkPassword("ç".repeat(37))).toBe("too_long");
  });

  it("recusa as senhas mais óbvias, repetições e sequências", () => {
    for (const obvious of ["senha123", "PASSWORD123", "roco2026", "11111111", "aaaaaaaaaa", "12345678", "87654321", "abcdefghij"]) {
      expect(checkPassword(obvious)).toBe("too_common");
    }
  });

  it("recusa senha que contém o nome do e-mail da conta", () => {
    expect(checkPassword("joaosilva2026!", { email: "joaosilva@empresa.com" })).toBe("contains_email");
    expect(checkPassword("minhaSenhaForte", { email: "ana@empresa.com" })).toBeNull();
  });

  it("recusa também cada pedaço do nome do e-mail (separado por . _ - +)", () => {
    const email = "Cadastro.Teste@roco.local";
    expect(checkPassword("cadastro-2026-vendas", { email })).toBe("contains_email");
    expect(checkPassword("vendas-TESTE-sul", { email })).toBe("contains_email");
    expect(checkPassword("maria_2026_sul", { email: "maria_souza+portal@empresa.com" })).toBe("contains_email");
    expect(checkPassword("portal-de-vendas", { email: "maria_souza+portal@empresa.com" })).toBe("contains_email");
  });

  it("ignora pedaços com menos de 4 letras do nome do e-mail", () => {
    expect(checkPassword("ti-do-sul-2026", { email: "jr.ti@empresa.com" })).toBeNull();
  });
});
