import { TRPCError } from "@trpc/server";

/**
 * Traduz erros do driver `pg` para `TRPCError` sem vazar detalhes internos
 * (constraint names, stack trace) para o cliente. `23505` = unique_violation.
 */
export function translateDbError(error: unknown, fallbackMessage: string): TRPCError {
  const pgError = error as { code?: string } | undefined;
  if (pgError?.code === "23505") {
    return new TRPCError({
      code: "CONFLICT",
      message: "Já existe um registro com esses dados (SKU/slug duplicado).",
    });
  }
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: fallbackMessage });
}
