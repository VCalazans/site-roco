#!/usr/bin/env node
/**
 * Aplica as migrations Drizzle usando SOMENTE dependências de produção.
 *
 * Por que este arquivo existe
 * ---------------------------
 * O `npm run db:migrate` chama `drizzle-kit`, que é uma **devDependency**.
 * A imagem de produção é `output: "standalone"`, então o container tem
 * apenas as deps de produção — `drizzle-kit: not found`. Pior: o Turbopack
 * inlina o `drizzle-orm` nos chunks do servidor, de modo que nem o pacote
 * existe em `node_modules`, e os arquivos `.sql` também não são copiados.
 * Resultado prático: o primeiro deploy subiu com o banco vazio e toda query
 * quebrava com `42P01 relation "products" does not exist`.
 *
 * O Dockerfile passou a copiar três coisas para o runner (`drizzle/`,
 * este script e `node_modules/drizzle-orm`), e este script usa o migrator
 * que já vem dentro do próprio `drizzle-orm` — a MESMA implementação que o
 * `drizzle-kit migrate` usa por baixo. Isso importa: a tabela de controle
 * (`drizzle.__drizzle_migrations`) e o hash SHA-256 de cada arquivo são
 * idênticos, então rodar este script no servidor e o `drizzle-kit migrate`
 * da máquina de desenvolvimento contra o mesmo banco não se atropelam —
 * cada um enxerga o que o outro já aplicou e pula.
 *
 * Uso
 * ---
 *   npm run db:migrate:container     (ou: node scripts/migrate.mjs)
 *
 * Requer `DATABASE_URL` no ambiente. É idempotente: aplica só o que falta,
 * então pode rodar a cada deploy sem risco.
 *
 * ⚠️ Não está no entrypoint de propósito. O migrator do Drizzle não pega
 * advisory lock, então N réplicas subindo juntas aplicariam a mesma
 * migration em paralelo. Enquanto for invocação manual (um comando, um
 * processo), não há corrida. Se algum dia isso virar automático no boot,
 * envolva a chamada em `pg_advisory_lock` antes.
 */
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const { Pool } = pg;
const require = createRequire(import.meta.url);

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder =
  process.env.DRIZZLE_MIGRATIONS_FOLDER ?? path.join(scriptDir, "..", "drizzle");

/**
 * Códigos que o operador vai encontrar de verdade quando o destino está
 * errado. A tradução existe porque a mensagem crua do driver é ambígua
 * fora de contexto — `ECONNREFUSED` sozinho não diz se o host está errado
 * ou se o serviço está fora.
 */
const DIAGNOSTICO = {
  ECONNREFUSED: "host alcançável mas nada escutando nessa porta (serviço fora, ou porta/host errados).",
  ENOTFOUND: "hostname não resolve — em Docker use o NOME DO SERVIÇO, não `localhost`.",
  EAI_AGAIN: "DNS não resolveu o hostname (típico dentro do Docker) — confira se o nome do serviço está certo e se o container está na MESMA rede do Postgres.",
  ETIMEDOUT: "sem resposta — firewall, security group ou host inacessível a partir daqui.",
  ECONNRESET: "conexão derrubada pelo servidor — comum quando o Postgres exige SSL e a URL não pede.",
  "28P01": "usuário ou senha inválidos.",
  "28000": "conexão rejeitada pelo pg_hba.conf — em banco gerenciado, quase sempre falta `?sslmode=require` na URL.",
  "3D000": "o database informado não existe nesse servidor.",
  "42501": "o usuário conectou mas não tem privilégio para criar objetos nesse banco.",
};

/**
 * Descreve o destino sem vazar credenciais — a connection string carrega a
 * senha, e este script roda em terminal de deploy e log de CI.
 *
 * Usa o parser do próprio `pg` (`pg-connection-string`, dependência dele e
 * portanto presente em qualquer lugar onde o driver rode) para que o que é
 * IMPRESSO seja exatamente o que é DISCADO — incluindo se a conexão vai ou
 * não usar SSL, causa clássica de falha em Postgres gerenciado.
 *
 * Carregado via `createRequire` e não por `import()`: dentro da imagem
 * standalone o Next preserva só o `index.js` (CJS) do pacote e PODA o
 * `esm/index.mjs` que o campo `exports` usa na condição `import` — um
 * `import()` ali falha com ERR_MODULE_NOT_FOUND. O require resolve o CJS,
 * que existe nos dois ambientes (verificado dentro do container).
 *
 * Cai para `new URL` e depois para uma mensagem neutra se algo falhar:
 * esta linha é diagnóstico, nunca pode ser o motivo de o script não rodar.
 */
function describeTarget(rawUrl) {
  try {
    const { parse } = require("pg-connection-string");
    const { host, port, database, sslmode, ssl } = parse(rawUrl);
    const usaSsl = Boolean(ssl) || Boolean(sslmode);
    return `${host ?? "?"}:${port ?? "5432"}/${database ?? "?"} (ssl: ${usaSsl ? sslmode ?? "sim" : "não"})`;
  } catch {
    try {
      const url = new URL(rawUrl);
      return `${url.hostname}:${url.port || "5432"}${url.pathname}`;
    } catch {
      return "(DATABASE_URL em formato não reconhecido)";
    }
  }
}

/**
 * Conta migrations já registradas.
 *
 * Só dois erros significam "primeira execução": schema `drizzle` inexistente
 * (3F000) e tabela inexistente (42P01). Qualquer outro — conexão recusada,
 * senha errada, falta de privilégio — precisa ABORTAR aqui. Engolir tudo
 * faria o script imprimir "Já aplicadas: 0" e seguir, dando ao operador um
 * número falso antes de falhar mais adiante por outro motivo.
 */
async function countApplied(pool) {
  try {
    const { rows } = await pool.query(
      "select count(*)::int as n from drizzle.__drizzle_migrations"
    );
    return rows[0]?.n ?? 0;
  } catch (error) {
    const code = error?.code ?? error?.cause?.code;
    if (code === "3F000" || code === "42P01") return 0;
    throw error;
  }
}

async function countPublicTables(pool) {
  const { rows } = await pool.query(
    "select count(*)::int as n from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'"
  );
  return rows[0]?.n ?? 0;
}

/**
 * Todo erro de banco que sai do `migrate()` é um `DrizzleQueryError`, e a
 * mensagem dele é SEMPRE `Failed query: <SQL>` — a causa real (ECONNREFUSED,
 * 28P01, SSL exigido) vive só em `.cause`. Como a primeira instrução do
 * migrator é `CREATE SCHEMA IF NOT EXISTS "drizzle"`, imprimir apenas
 * `error.message` faz qualquer falha de conexão parecer problema de
 * privilégio nesse CREATE SCHEMA. Por isso a cadeia é desempacotada aqui.
 */
function reportarErro(error) {
  // Duas formas chegam aqui e precisam do mesmo tratamento:
  //  - erro CRU do `pg` (vindo de countApplied): `.code` no topo, sem `.cause`;
  //  - `DrizzleQueryError` (vindo de migrate()): `.message` é sempre
  //    "Failed query: <SQL>" e o que interessa está em `.cause`.
  // Normalizamos para uma "raiz" única para que o operador leia o motivo real
  // na primeira linha nos dois casos.
  const causa = error?.cause;
  const raiz = causa ?? error;
  const codigo = raiz?.code ?? error?.code;

  // `localhost` resolve para 127.0.0.1 E ::1; o Node tenta os dois e agrega
  // as falhas num `AggregateError` cuja `.message` é VAZIA — foi exatamente
  // essa a forma do erro no primeiro diagnóstico deste deploy
  // (`AggregateError:` seguido de `[errors]: [ [Error], [Error] ]`).
  // Sem desempacotar `.errors`, a linha principal sai em branco.
  const agregados = Array.isArray(raiz?.errors) ? raiz.errors : null;
  const detalheAgregado = agregados
    ?.map((e) => e?.message)
    .filter(Boolean)
    .join(" / ");

  console.error(
    "[migrate] Falhou:",
    raiz?.message || detalheAgregado || error?.message || error
  );

  // Quando havia embrulho, o SQL em execução vira contexto secundário —
  // útil para saber em que ponto parou, mas nunca como causa.
  if (causa && error?.message) {
    console.error("[migrate] Durante:", String(error.message).split("\n")[0]);
  }

  const identificacao = [codigo, raiz?.severity].filter(Boolean).join(" | ");
  if (identificacao) console.error("[migrate] Código:", identificacao);
  if (raiz?.detail) console.error("[migrate] Detalhe:", raiz.detail);
  if (raiz?.hint) console.error("[migrate] Dica do Postgres:", raiz.hint);

  if (codigo && DIAGNOSTICO[codigo]) {
    console.error("[migrate] Provável motivo:", DIAGNOSTICO[codigo]);
  } else if (!codigo && raiz?.stack) {
    // Sem código conhecido não há o que traduzir; aí o stack ajuda.
    console.error(raiz.stack);
  }
}

const connectionString = process.env.DATABASE_URL?.trim();

if (!connectionString) {
  console.error(
    "[migrate] DATABASE_URL não definida. Exporte a connection string do Postgres antes de rodar."
  );
  process.exit(1);
}

console.log(`[migrate] Destino: ${describeTarget(connectionString)}`);
console.log(`[migrate] Migrations: ${migrationsFolder}`);

const pool = new Pool({ connectionString });

try {
  const antes = await countApplied(pool);
  console.log(`[migrate] Já aplicadas: ${antes}`);

  await migrate(drizzle(pool), { migrationsFolder });

  const depois = await countApplied(pool);
  const tabelas = await countPublicTables(pool);
  const aplicadas = depois - antes;

  console.log(
    aplicadas > 0
      ? `[migrate] Aplicadas agora: ${aplicadas} (total ${depois}).`
      : "[migrate] Nada pendente — banco já estava atualizado."
  );
  console.log(`[migrate] Tabelas em "public": ${tabelas}`);
  console.log("[migrate] Concluído.");
} catch (error) {
  reportarErro(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
