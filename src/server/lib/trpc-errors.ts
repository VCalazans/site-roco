import type { TRPCError } from "@trpc/server";
import { pgErrorCode } from "./pg-error";

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

/** Código do banco (SQLSTATE) do erro, se houver — o único detalhe da causa que vai ao log. */
export function unexpectedErrorCode(error: TRPCError): string | undefined {
  return pgErrorCode(error.cause);
}

/** Erros internos do tRPC: os únicos que ganham referência (o resto o operador entende pela mensagem). */
export function isInternalError(error: TRPCError): boolean {
  return error.code === "INTERNAL_SERVER_ERROR";
}

const errorRefs = new WeakMap<object, string>();

/**
 * Referência curta de um erro interno, a mesma no log (`onError`) e na resposta
 * (`errorFormatter`): o cliente mostra só ela ao operador; rota e código do
 * banco ficam no log do servidor. Quem reporta o erro passa a referência.
 */
export function errorRefOf(error: TRPCError): string {
  let ref = errorRefs.get(error);
  if (!ref) {
    ref = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
    errorRefs.set(error, ref);
  }
  return ref;
}

/** Mensagem que o cliente recebe no lugar da original. */
export const UNEXPECTED_ERROR_MESSAGE = "internal_error";
