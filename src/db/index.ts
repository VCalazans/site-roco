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
/**
 * Teto de duração de UMA query, aplicado pelo SERVIDOR (o `pg` manda
 * `statement_timeout` no startup packet da conexão — ver
 * `getStartupConf()` em `pg/lib/client.js`; o valor nu é lido pelo
 * Postgres em milissegundos). Sem ele o servidor roda com
 * `statement_timeout = 0`, isto é, SEM teto nenhum: uma query
 * descontrolada prende um dos 10 slots do pool indefinidamente e, com
 * poucas dessas, o pool inteiro fica indisponível para o resto do app.
 *
 * Por que 15 s é seguro para o TRABALHO de cada statement: o limite é POR
 * STATEMENT, não por transação. Todo statement que passa por este pool é
 * linha-a-linha (`.limit(1)`, `eq(id)`), paginado, ou um lote pequeno
 * (`inArray` do `assembleProducts`, a matriz de permissões do
 * `roles.updateRolePermissions`). As 4 transações do app
 * (products.create/update, roles, register) são sequências de statements
 * curtos — nenhuma depende de um único comando longo. As cargas realmente
 * pesadas (`db:seed`, `db:import-catalog`, `db:import-images`,
 * `scripts/migrate.mjs`, `bootstrap-producao`) NÃO usam este pool: cada uma
 * abre o seu próprio `new Pool(...)` e não é afetada por este teto.
 *
 * ⚠️ O RELÓGIO NÃO CONTA SÓ TRABALHO. O Postgres mede o `statement_timeout`
 * do instante em que o comando CHEGA ao servidor até ele terminar, o que
 * INCLUI espera por lock. Um statement trivial parado atrás de um
 * `ACCESS EXCLUSIVE` (um `CREATE INDEX` de migration rodando no boot de um
 * container novo enquanto o antigo ainda serve tráfego; uma sessão `psql`
 * esquecida em `idle in transaction`) é abortado com `57014` igual a uma
 * query descontrolada. Verificado contra Postgres 17: com o teto ligado o
 * `INSERT` foi cancelado e gravou 0 linhas; sem o teto, o mesmo `INSERT`
 * esperou o lock e gravou.
 *
 * Consequência prática: quem NÃO PODE perder a escrita precisa tratar
 * `57014`. Hoje isso é o `INSERT` do lead em `POST /api/contact`, que tenta
 * uma segunda vez nesse código específico (ver `isStatementTimeout` em
 * `server/lib/pg-error.ts`) — sem isso, este teto reintroduziria por uma
 * porta estreita exatamente a falha "LEAD PERDIDO" que motivou recusar o
 * `connectionTimeoutMillis` no pool.
 */
const STATEMENT_TIMEOUT_MS = 15_000;

/**
 * Tamanho do pool. 10 já é o default do `pg-pool`; está explícito aqui
 * para registrar a INTENÇÃO, não para mudar comportamento.
 *
 * NÃO SUBA ESTE NÚMERO para "aguentar mais carga". Foi medido em teste de
 * carga no container: o gargalo é CPU (um único event loop satura ~1 core
 * renderizando páginas), não o banco — o Postgres nunca passou de 10
 * conexões, todas ociosas (`active=0`), contra `max_connections=100`, até
 * 500 requisições concorrentes. Mais conexões só colocariam mais trabalho
 * disputando o mesmo core. Capacidade se ganha com mais réplicas/CDN.
 *
 * Exportado para o `/api/health` distinguir "pool saturado" de "banco fora
 * do ar" sem repetir o número.
 */
export const DB_POOL_MAX_CONNECTIONS = 10;

globalThis.__rocoDbPool ??= new Pool({
  connectionString: process.env.DATABASE_URL,
  max: DB_POOL_MAX_CONNECTIONS,
  statement_timeout: STATEMENT_TIMEOUT_MS,
});
globalThis.__rocoDb ??= drizzle(globalThis.__rocoDbPool, { schema });

export const db: Database = globalThis.__rocoDb;

/**
 * O `Pool` por trás do `db`, exposto SOMENTE para leitura de métricas
 * (`totalCount`/`idleCount`/`waitingCount` em `/api/health`). Esses
 * contadores são getters sobre arrays internas do `pg-pool` — lê-los não
 * abre conexão nem toca no banco. Não use este export para rodar query:
 * o caminho normal é o `db` (Drizzle).
 */
export const dbPool: Pool = globalThis.__rocoDbPool;
