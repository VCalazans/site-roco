import { describe, expect, it } from "vitest";
import {
  representativeAdminUpdateSchema,
  splitRepresentativeAdminUpdate,
} from "./representative-admin-update";

const ID = "3f6c2b1e-9a4d-4c8e-8b1a-2d5e7f9a0b1c";

function issueCodes(input: Record<string, unknown>) {
  const result = representativeAdminUpdateSchema.safeParse({ id: ID, ...input });
  return result.success ? [] : result.error.issues.map((issue) => [issue.path[0], issue.message]);
}

describe("representativeAdminUpdateSchema", () => {
  it("aceita o cadastro completo e normaliza CNPJ, telefone e e-mail", () => {
    const parsed = representativeAdminUpdateSchema.parse({
      id: ID,
      name: "  Victor Costa ",
      email: " Victor@Archicode.com.BR ",
      companyName: "Archicode",
      cnpj: "11222333000181",
      phone: "47999991234",
      region: "Vale do Itajaí",
      notes: "linha 1\nlinha 2",
    });
    expect(parsed).toEqual({
      id: ID,
      name: "Victor Costa",
      email: "victor@archicode.com.br",
      companyName: "Archicode",
      cnpj: "11.222.333/0001-81",
      phone: "(47) 99999-1234",
      region: "Vale do Itajaí",
      notes: "linha 1\nlinha 2",
    });
  });

  it("nunca formata a razão social como CNPJ (bug AR.CHI.COD/E)", () => {
    const parsed = representativeAdminUpdateSchema.parse({ id: ID, companyName: "ARCHICODE" });
    expect(parsed.companyName).toBe("ARCHICODE");
  });

  it("campos opcionais vazios viram null (limpar)", () => {
    const parsed = representativeAdminUpdateSchema.parse({
      id: ID,
      companyName: "",
      cnpj: "   ",
      phone: "",
      region: "",
      notes: "",
    });
    expect(parsed).toMatchObject({
      companyName: null,
      cnpj: null,
      phone: null,
      region: null,
      notes: null,
    });
  });

  it("rejeita CNPJ inválido, telefone inválido e e-mail inválido com códigos traduzíveis", () => {
    expect(issueCodes({ cnpj: "11.222.333/0001-82" })).toEqual([["cnpj", "invalid_cnpj"]]);
    expect(issueCodes({ cnpj: "ARCHICODE" })).toEqual([["cnpj", "invalid_cnpj"]]);
    expect(issueCodes({ phone: "1234" })).toEqual([["phone", "invalid_phone"]]);
    expect(issueCodes({ email: "nao-e-email" })).toEqual([["email", "invalid_email"]]);
  });

  it("nome e e-mail não podem ser apagados", () => {
    expect(issueCodes({ name: "  " })).toEqual([["name", "required"]]);
    expect(issueCodes({ email: "" })).toEqual([["email", "invalid_email"]]);
  });

  it("exige id uuid", () => {
    expect(representativeAdminUpdateSchema.safeParse({ id: "abc" }).success).toBe(false);
  });
});

describe("splitRepresentativeAdminUpdate", () => {
  it("separa campos de user e de representatives e descarta os não enviados", () => {
    const parsed = representativeAdminUpdateSchema.parse({
      id: ID,
      email: "novo@exemplo.com",
      cnpj: "11.222.333/0001-81",
      region: "",
    });
    expect(splitRepresentativeAdminUpdate(parsed)).toEqual({
      id: ID,
      userPatch: { email: "novo@exemplo.com" },
      representativePatch: { cnpj: "11.222.333/0001-81", region: null },
    });
  });

  it("patch só com id não altera nada", () => {
    const parsed = representativeAdminUpdateSchema.parse({ id: ID });
    expect(splitRepresentativeAdminUpdate(parsed)).toEqual({
      id: ID,
      userPatch: {},
      representativePatch: {},
    });
  });
});
