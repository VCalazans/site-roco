import { getTRPCErrorFromUnknown, TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { errorRefOf, isUnexpectedError, unexpectedErrorCode } from "./trpc-errors";

/** Erro como o Drizzle o lança: mensagem com a consulta e os parâmetros, erro do pg na causa. */
function drizzleError() {
  const pg = Object.assign(new Error('missing FROM-clause entry for table "user"'), { code: "42P01" });
  return new Error("Failed query: select count(*) from representatives where user.email ilike $1\nparams: %maria@x.com%", {
    cause: pg,
  });
}

describe("isUnexpectedError", () => {
  it("erro não tratado (embrulhado pelo tRPC) é inesperado", () => {
    const wrapped = getTRPCErrorFromUnknown(drizzleError());
    expect(wrapped.code).toBe("INTERNAL_SERVER_ERROR");
    expect(isUnexpectedError(wrapped)).toBe(true);
    expect(unexpectedErrorCode(wrapped)).toBe("42P01");
  });

  it("erro lançado de propósito passa — inclusive INTERNAL_SERVER_ERROR com mensagem própria", () => {
    expect(isUnexpectedError(new TRPCError({ code: "CONFLICT", message: "email_exists" }))).toBe(false);
    expect(isUnexpectedError(new TRPCError({ code: "NOT_FOUND", message: "Cadastro não encontrado." }))).toBe(false);
    expect(
      isUnexpectedError(
        new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao salvar o cadastro.", cause: drizzleError() })
      )
    ).toBe(false);
  });
});

describe("errorRefOf", () => {
  it("devolve a mesma referência para o mesmo erro e outra para outro erro", () => {
    const a = new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "x" });
    const b = new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "x" });
    expect(errorRefOf(a)).toMatch(/^[0-9A-F]{8}$/);
    expect(errorRefOf(a)).toBe(errorRefOf(a));
    expect(errorRefOf(a)).not.toBe(errorRefOf(b));
  });
});
