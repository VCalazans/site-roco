/**
 * Reconhecimento de códigos de erro do PostgreSQL (SQLSTATE) em erros do
 * driver `pg`.
 *
 * Módulo puro (sem `server-only`, sem tRPC) de propósito: é consumido tanto
 * por Route Handler quanto por procedure, e precisa ser testável sem carregar
 * nem banco nem tRPC. Para traduzir erro em `TRPCError`, veja `db-error.ts`.
 */

/**
 * `57014` = `query_canceled`. É o código que o Postgres devolve quando o
 * `statement_timeout` (configurado no pool em `src/db/index.ts`) aborta um
 * comando.
 */
export const PG_QUERY_CANCELED = "57014";

/**
 * `true` quando o erro é um statement abortado pelo `statement_timeout`.
 *
 * POR QUE ISSO IMPORTA, e não é só "query lenta demais": o Postgres mede o
 * `statement_timeout` do instante em que o comando CHEGA ao servidor até ele
 * terminar — e essa contagem INCLUI espera por lock. Um `INSERT` trivial
 * parado atrás de um `ACCESS EXCLUSIVE` (um `CREATE INDEX` de migration
 * rodando no boot de um container novo, por exemplo, enquanto o container
 * antigo ainda serve tráfego) é abortado com 57014 exatamente como uma query
 * descontrolada seria — mesmo sem ter feito trabalho nenhum.
 *
 * Por isso o ponto do sistema que não pode perder a escrita (o `INSERT` do
 * lead em `POST /api/contact`) trata este código à parte: nesse caso vale
 * tentar de novo, porque o obstáculo era o lock, não a query.
 */
export function isStatementTimeout(error: unknown): boolean {
  return pgErrorCode(error) === PG_QUERY_CANCELED;
}

/**
 * SQLSTATE do erro, venha ele cru do driver `pg` ou embrulhado pelo Drizzle.
 * Desde o drizzle-orm 0.45 toda falha de consulta chega como
 * `DrizzleQueryError`, com o erro do `pg` em `cause` — ler só `error.code`
 * nunca acha o código (um SKU duplicado virava 500 genérico em vez de 409).
 */
export function pgErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const withCode = error as { code?: unknown; cause?: { code?: unknown } | null };
  const code = withCode.cause?.code ?? withCode.code;
  return typeof code === "string" ? code : undefined;
}
