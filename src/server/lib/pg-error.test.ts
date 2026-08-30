import { describe, expect, it } from "vitest";
import { isStatementTimeout, PG_QUERY_CANCELED } from "./pg-error";

describe("isStatementTimeout", () => {
  it("reconhece o erro que o statement_timeout do pool produz", () => {
    // Forma real do erro do driver `pg`: um Error com `.code` SQLSTATE.
    const error = Object.assign(new Error("canceling statement due to statement timeout"), {
      code: PG_QUERY_CANCELED,
    });
    expect(isStatementTimeout(error)).toBe(true);
  });

  it("reconhece objeto simples com o código (erro serializado/repassado)", () => {
    expect(isStatementTimeout({ code: "57014" })).toBe(true);
  });

  describe("não confunde com outros erros do banco", () => {
    it.each([
      ["unique_violation", "23505"],
      ["undefined_table (o 42P01 do incidente de migration)", "42P01"],
      ["invalid_password", "28P01"],
      ["lock_not_available", "55P03"],
      // 57014 é query_canceled; 57P01 é admin_shutdown. Prefixo igual, caso diferente.
      ["admin_shutdown", "57P01"],
    ])("ignora %s", (_label, code) => {
      expect(isStatementTimeout({ code })).toBe(false);
    });
  });

  describe("entradas degeneradas nunca lançam", () => {
    it.each([
      ["null", null],
      ["undefined", undefined],
      ["string", "57014"],
      ["número", 57014],
      ["Error sem code", new Error("boom")],
      ["objeto vazio", {}],
      ["code numérico (não é o SQLSTATE textual)", { code: 57014 }],
      ["code em outra caixa", { code: "57014 " }],
    ])("devolve false para %s", (_label, value) => {
      expect(isStatementTimeout(value)).toBe(false);
    });
  });
});
