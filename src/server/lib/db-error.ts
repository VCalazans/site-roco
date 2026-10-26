import { TRPCError } from "@trpc/server";
import { pgErrorCode } from "./pg-error";

/**
 * Traduz erros do banco para `TRPCError` sem vazar detalhes internos
 * (constraint names, consulta, parâmetros) para o cliente. `23505` =
 * unique_violation → CONFLICT. O SQLSTATE é lido também dentro do
 * `DrizzleQueryError` (`pgErrorCode`).
 *
 * O resto vira INTERNAL_SERVER_ERROR com a mensagem de reserva e o erro
 * original em `cause`: o `errorFormatter` (`src/server/trpc/init.ts`) grava no
 * log só o código do banco com uma referência, e o cliente recebe só a referência.
 */
export function translateDbError(error: unknown, fallbackMessage: string): TRPCError {
  if (pgErrorCode(error) === "23505") {
    return new TRPCError({
      code: "CONFLICT",
      message: "Já existe um registro com esses dados (SKU/slug duplicado).",
    });
  }
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: fallbackMessage, cause: error });
}
