import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

type Database = NodePgDatabase<typeof schema>;

declare global {
  var __rocoDbPool: Pool | undefined;
  var __rocoDb: Database | undefined;
}

/**
 * Cliente Drizzle singleton (HMR-safe via `globalThis`, como as referências
 * da casa).
 *
 * A conexão é lazy por natureza do driver `pg`: `new Pool()` só guarda a
 * config — nenhum socket é aberto até a primeira query. Por isso este módulo
 * pode ser importado (e até avaliado durante `next build`, ex.: nas páginas
 * `/portal/*`) sem `DATABASE_URL` definida; o build só quebraria se alguma
 * rota executasse uma query de fato durante a coleta de páginas, o que não
 * acontece aqui (sem sessão, os callbacks de auth que tocam o banco não
 * rodam). Uma instância real (não um Proxy) é necessária porque o
 * `@auth/drizzle-adapter` identifica o "sabor" do banco via
 * `instanceof`/entity-kind do Drizzle — um Proxy sobre um objeto vazio falha
 * nessa checagem mesmo antes de qualquer query.
 */
globalThis.__rocoDbPool ??= new Pool({ connectionString: process.env.DATABASE_URL });
globalThis.__rocoDb ??= drizzle(globalThis.__rocoDbPool, { schema });

export const db: Database = globalThis.__rocoDb;
