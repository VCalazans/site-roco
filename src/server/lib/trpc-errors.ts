import type { TRPCError } from "@trpc/server";

/**
 * Erro INESPERADO num procedure (bug, falha do banco): o tRPC o embrulha num
 * `INTERNAL_SERVER_ERROR` com a mensagem ORIGINAL — e a do Drizzle traz a
 * consulta SQL com os parâmetros (nome, e-mail, hash de senha…). Esse texto não
 * pode chegar ao navegador nem ao log de produção.
 *
 * Erro lançado de propósito (`new TRPCError({ code, message })`, inclusive
 * `INTERNAL_SERVER_ERROR` com mensagem própria, como o de `translateDbError`)
 * tem mensagem diferente da causa e passa como está.
 */
export function isUnexpectedError(error: TRPCError): boolean {
  return (
    error.code === "INTERNAL_SERVER_ERROR" &&
    error.cause instanceof Error &&
    error.message === error.cause.message
  );
}

/** Código do banco (SQLSTATE) do erro inesperado, se houver — o único detalhe que vai ao log. */
export function unexpectedErrorCode(error: TRPCError): string | undefined {
  const cause = error.cause as { code?: unknown; cause?: { code?: unknown } } | undefined;
  const code = cause?.cause?.code ?? cause?.code;
  return typeof code === "string" ? code : undefined;
}

/** Mensagem que o cliente recebe no lugar da original. */
export const UNEXPECTED_ERROR_MESSAGE = "internal_error";
