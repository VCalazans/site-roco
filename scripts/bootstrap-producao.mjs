#!/usr/bin/env node
/**
 * Carga inicial do ambiente de PRODUÇÃO, em um comando.
 *
 * Roda, em ordem: migrations → roles/permissões/admin → catálogo →
 * publicação dos produtos → upload das fotos para o R2. Cada etapa é
 * idempotente, então o script pode ser re-executado sem duplicar nada.
 *
 * ONDE COLOCAR A CREDENCIAL
 * -------------------------
 * Crie `.env.producao.local` na raiz do repo (já coberto pelo .gitignore
 * via `.env*.local`, então não vai para o git) com UMA linha:
 *
 *     PRODUCTION_DATABASE_URL=postgres://usuario:senha@host:5432/banco
 *
 * O nome é deliberadamente diferente de `DATABASE_URL`: assim o seu
 * ambiente local continua apontando para o Postgres de desenvolvimento e
 * não existe o risco clássico de esquecer a variável trocada e mexer em
 * produção sem perceber.
 *
 * As demais variáveis (PORTAL_ADMIN_EMAIL, PORTAL_ADMIN_PASSWORD e as
 * R2_*) são lidas do `.env.local`/`.env` que você já tem.
 *
 * USO
 * ---
 *     npm run db:bootstrap-producao -- --dry-run   # só mostra o estado atual
 *     npm run db:bootstrap-producao                # roda tudo (pede confirmação)
 *     npm run db:bootstrap-producao -- --sim       # roda sem perguntar
 *
 *     npm run db:bootstrap-producao -- --so=fotos          # só uma etapa
 *     npm run db:bootstrap-producao -- --pular=fotos       # tudo menos uma
 *
 * Etapas (ids para --so / --pular):
 *     migrations, seed, catalogo, publicar, fotos
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const require = createRequire(import.meta.url);
const raizRepo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* ------------------------------------------------------------------ *
 * Env                                                                  *
 * ------------------------------------------------------------------ */

/**
 * Mesmo formato do loader de `import-product-images.ts`: não sobrescreve o
 * que já veio do ambiente, para que um `VAR=x npm run ...` continue vencendo
 * o arquivo.
 */
function carregarEnv(arquivos) {
  for (const arquivo of arquivos) {
    const caminho = path.join(raizRepo, arquivo);
    if (!fs.existsSync(caminho)) continue;
    for (const linha of fs.readFileSync(caminho, "utf8").split(/\r?\n/)) {
      if (linha.trimStart().startsWith("#")) continue;
      const m = /^([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(linha);
      if (!m) continue;
      const [, nome, valor] = m;
      if (process.env[nome] !== undefined) continue;
      process.env[nome] = valor.trim().replace(/^(['"])(.*)\1$/, "$2");
    }
  }
}

carregarEnv([".env.producao.local", ".env.local", ".env"]);

const URL_PRODUCAO = process.env.PRODUCTION_DATABASE_URL?.trim();

/* ------------------------------------------------------------------ *
 * Utilidades                                                           *
 * ------------------------------------------------------------------ */

/** Host:porta/base, sem nunca imprimir a senha (isto vai para o terminal). */
function descreverDestino(url) {
  try {
    const { parse } = require("pg-connection-string");
    const { host, port, database } = parse(url);
    return `${host ?? "?"}:${port ?? "5432"}/${database ?? "?"}`;
  } catch {
    try {
      const u = new URL(url);
      return `${u.hostname}:${u.port || "5432"}${u.pathname.replace(/^\//, "")}`;
    } catch {
      return "(formato não reconhecido)";
    }
  }
}

/** Roda um comando npm herdando o stdio, com env extra. */
function rodar(comando, args, envExtra = {}) {
  return new Promise((resolve) => {
    const filho = spawn(comando, args, {
      cwd: raizRepo,
      stdio: "inherit",
      shell: true, // resolve npm.cmd no Windows
      env: { ...process.env, ...envExtra },
    });
    filho.on("close", (code) => resolve(code ?? 1));
    filho.on("error", () => resolve(1));
  });
}

async function estado(pool) {
  const consulta = async (sql, padrao = 0) => {
    try {
      const { rows } = await pool.query(sql);
      return Number(rows[0]?.n ?? padrao);
    } catch {
      return null; // tabela ainda não existe
    }
  };
  return {
    tabelas: await consulta(
      "select count(*)::int as n from information_schema.tables where table_schema='public' and table_type='BASE TABLE'"
    ),
    produtos: await consulta("select count(*)::int as n from products"),
    publicados: await consulta("select count(*)::int as n from products where published"),
    imagens: await consulta("select count(*)::int as n from product_images"),
    categorias: await consulta("select count(*)::int as n from categories"),
    roles: await consulta("select count(*)::int as n from roles"),
    permissoes: await consulta("select count(*)::int as n from permissions"),
    usuarios: await consulta('select count(*)::int as n from "user"'),
    heroSlides: await consulta("select count(*)::int as n from hero_slides where published"),
  };
}

function imprimirEstado(rotulo, e) {
  const v = (x) => (x === null ? "—" : String(x));
  console.log(`\n  ${rotulo}`);
  console.log(`    tabelas .......... ${v(e.tabelas)}`);
  console.log(`    produtos ......... ${v(e.produtos)}  (publicados: ${v(e.publicados)})`);
  console.log(`    categorias ....... ${v(e.categorias)}`);
  console.log(`    imagens .......... ${v(e.imagens)}`);
  console.log(`    roles/permissões . ${v(e.roles)}/${v(e.permissoes)}`);
  console.log(`    usuários ......... ${v(e.usuarios)}`);
  console.log(`    slides do hero ... ${v(e.heroSlides)}`);
}

/* ------------------------------------------------------------------ *
 * Etapas                                                               *
 * ------------------------------------------------------------------ */

async function publicarProdutos(pool) {
  const { rowCount } = await pool.query(
    "update products set published = true, updated_at = now() where published = false"
  );
  console.log(`[publicar] ${rowCount} produto(s) publicado(s).`);
  const { rows } = await pool.query(
    "select count(*)::int as n from products where published and active"
  );
  console.log(`[publicar] Visíveis no site agora: ${rows[0]?.n ?? 0}`);
  return 0;
}

const ETAPAS = [
  {
    id: "migrations",
    titulo: "Migrations (cria/atualiza as tabelas)",
    executar: () => rodar("npm", ["run", "db:migrate:container"], { DATABASE_URL: URL_PRODUCAO }),
  },
  {
    id: "seed",
    titulo: "Roles, permissões e usuário admin",
    executar: () => rodar("npm", ["run", "db:seed"], { DATABASE_URL: URL_PRODUCAO }),
  },
  {
    id: "hero",
    titulo: "Slide do hero (vídeo institucional do R2)",
    executar: () => rodar("npm", ["run", "db:seed-hero-slide"], { DATABASE_URL: URL_PRODUCAO }),
  },
  {
    id: "catalogo",
    titulo: "Importar catálogo (produtos, categorias, embalagens)",
    executar: () => rodar("npm", ["run", "db:import-catalog"], { DATABASE_URL: URL_PRODUCAO }),
  },
  {
    id: "publicar",
    titulo: "Publicar produtos (published = true)",
    executar: (pool) => publicarProdutos(pool),
  },
  {
    id: "fotos",
    titulo: "Enviar fotos para o R2",
    executar: () => rodar("npm", ["run", "db:import-images"], { DATABASE_URL: URL_PRODUCAO }),
  },
];

/* ------------------------------------------------------------------ *
 * Main                                                                 *
 * ------------------------------------------------------------------ */

const args = process.argv.slice(2);
const temFlag = (nome) => args.includes(`--${nome}`);
const valorFlag = (nome) => {
  const item = args.find((a) => a.startsWith(`--${nome}=`));
  return item ? item.slice(nome.length + 3) : null;
};

const dryRun = temFlag("dry-run");
const semPerguntar = temFlag("sim");
const so = valorFlag("so")?.split(",").map((s) => s.trim()).filter(Boolean) ?? null;
const pular = valorFlag("pular")?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];

if (!URL_PRODUCAO) {
  console.error(`
[bootstrap] PRODUCTION_DATABASE_URL não encontrada.

Crie o arquivo .env.producao.local na raiz do repo com uma linha:

    PRODUCTION_DATABASE_URL=postgres://usuario:senha@host:5432/banco

Esse arquivo já é ignorado pelo git (.env*.local), então a credencial não
vai para o repositório. O nome é diferente de DATABASE_URL de propósito:
seu ambiente local continua apontando para o Postgres de desenvolvimento.
`);
  process.exit(1);
}

const selecionadas = ETAPAS.filter(
  (e) => (!so || so.includes(e.id)) && !pular.includes(e.id)
);

if (selecionadas.length === 0) {
  console.error("[bootstrap] Nenhuma etapa selecionada. Ids válidos:", ETAPAS.map((e) => e.id).join(", "));
  process.exit(1);
}

console.log("=".repeat(70));
console.log("  CARGA INICIAL — AMBIENTE DE PRODUÇÃO");
console.log("=".repeat(70));
console.log(`\n  Destino: ${descreverDestino(URL_PRODUCAO)}`);
console.log(`  Etapas:  ${selecionadas.map((e) => e.id).join(" → ")}`);

const pool = new Pool({ connectionString: URL_PRODUCAO });

try {
  const antes = await estado(pool);
  imprimirEstado("Estado ATUAL:", antes);

  if (dryRun) {
    console.log("\n  [dry-run] Nada foi alterado. Rode sem --dry-run para executar.\n");
    await pool.end();
    process.exit(0);
  }

  if (!semPerguntar) {
    const nomeBanco = descreverDestino(URL_PRODUCAO).split("/").pop();
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log("\n  Isto vai ESCREVER no banco acima.");
    const resposta = await rl.question(`  Digite o nome do banco (${nomeBanco}) para confirmar: `);
    rl.close();
    if (resposta.trim() !== nomeBanco) {
      console.log("\n  Cancelado — o texto não confere.\n");
      await pool.end();
      process.exit(1);
    }
  }

  for (const [indice, etapa] of selecionadas.entries()) {
    console.log("\n" + "-".repeat(70));
    console.log(`  ETAPA ${indice + 1}/${selecionadas.length}: ${etapa.titulo}`);
    console.log("-".repeat(70));

    const codigo = await etapa.executar(pool);
    if (codigo !== 0) {
      console.error(`\n[bootstrap] A etapa "${etapa.id}" falhou (código ${codigo}). Parando aqui.`);
      console.error("[bootstrap] Corrija o motivo acima e rode de novo — as etapas já concluídas");
      console.error(`[bootstrap] são idempotentes, ou use --so=${etapa.id} para retomar só desta.`);
      await pool.end();
      process.exit(1);
    }
  }

  const depois = await estado(pool);
  console.log("\n" + "=".repeat(70));
  imprimirEstado("Estado FINAL:", depois);
  console.log("\n  Pronto. O cache do site leva até 5 min para refletir (revalidate 300s).\n");
} catch (erro) {
  console.error("\n[bootstrap] Falhou:", erro?.message ?? erro);
  const causa = erro?.cause ?? erro;
  if (causa?.code) console.error("[bootstrap] Código:", causa.code);
  process.exitCode = 1;
} finally {
  await pool.end();
}
