/**
 * Carga inicial de imagens de produto (docs/PRODUTOS → R2 + Postgres).
 *
 * Roda FORA do bundler do Next.js — importa por caminho relativo (nunca
 * `@/db`/`@/core/storage`, que são `server-only`), mesmo padrão de
 * `import-catalog.ts`. Cria seus próprios clients Drizzle/pg e S3 efêmeros.
 *
 * Uso:
 *   npm run db:import-images             # sobe tudo que ainda não existe
 *   npm run db:import-images -- --dry-run   # só relata, não toca R2/banco
 *   npm run db:import-images -- --limit=5   # smoke com N imagens
 *
 * Fonte: `docs/PRODUTOS/*.{png,jpg,jpeg,webp}` — o nome do arquivo (sem
 * extensão) é o `products.sku` (ex.: `1000.png` → produto SKU 1000).
 * Variantes com sufixo (`1122_v2.png`, `1263_01.png`, `1751 - 2.png`, ...)
 * são atribuídas ao produto do PREFIXO numérico (≥3 dígitos) e entram como
 * imagens secundárias da galeria: o arquivo exato `sku.ext` fica com
 * sortOrder 0 (imagem padrão) e as variantes seguem em ordem alfabética.
 * Arquivos-fonte de design (.psd/.psb/.aet) e subpastas são ignorados.
 *
 * COMPATÍVEL COM O PORTAL (requisito da carga, 2026-08-23): cada upload usa
 * a MESMA chave do fluxo presign/confirm do admin —
 * `products/{sku}/{uuid}.{ext}` (ver products.presignImageUpload) — e insere
 * em `product_images` com os mesmos campos (contentType validado contra os
 * tipos aceitos, tamanho ≤ 10MB, altPt/altEn = nome do produto). Assim o
 * time consegue, pelo portal, listar/adicionar/substituir/excluir estas
 * imagens exatamente como as que subirem manualmente depois.
 *
 * Idempotente: uma imagem seed é identificada por (produto, filename) — a
 * re-execução pula o que já foi registrado, então rodar de novo após o time
 * já ter mexido no acervo não duplica nem sobrescreve nada.
 *
 * Env: lê `.env.local` e depois `.env` (sem sobrescrever o ambiente) —
 * precisa de DATABASE_URL + R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/
 * R2_SECRET_ACCESS_KEY/R2_BUCKET.
 *
 * Cache: o site público lê via `unstable_cache` (tag "products",
 * revalidate 300s) — as imagens aparecem em até 5min, sem passo extra.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { productImages, products } from "../schema/catalog";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..", "..");
const IMAGES_DIR = path.join(repoRoot, "docs", "PRODUTOS");

/** Espelha ALLOWED_IMAGE_TYPES/MAX_IMAGE_BYTES do router de produtos. */
const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const CONCURRENCY = 8;
const UPLOAD_RETRIES = 2;

function loadEnvFiles(): void {
  for (const file of [".env.local", ".env"]) {
    const fullPath = path.join(repoRoot, file);
    if (!fs.existsSync(fullPath)) continue;
    for (const line of fs.readFileSync(fullPath, "utf8").split(/\r?\n/)) {
      const match = /^([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!match || line.trimStart().startsWith("#")) continue;
      const [, name, rawValue] = match;
      if (process.env[name] !== undefined) continue;
      process.env[name] = rawValue.replace(/^(['"])(.*)\1$/, "$2");
    }
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} não configurada (ver .env.local).`);
  }
  return value;
}

type SeedFile = {
  filename: string;
  sku: string;
  extension: string;
  contentType: string;
  sizeBytes: number;
};

function listSeedFiles(): { files: SeedFile[]; skipped: string[] } {
  const files: SeedFile[] = [];
  const skipped: string[] = [];
  for (const entry of fs.readdirSync(IMAGES_DIR, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const extension = path.extname(entry.name).toLowerCase();
    const contentType = CONTENT_TYPE_BY_EXTENSION[extension];
    if (!contentType) {
      skipped.push(entry.name);
      continue;
    }
    const sizeBytes = fs.statSync(path.join(IMAGES_DIR, entry.name)).size;
    files.push({
      filename: entry.name,
      sku: path.basename(entry.name, path.extname(entry.name)).trim(),
      extension: extension.replace(/^\.jpeg$/, ".jpg"),
      contentType,
      sizeBytes,
    });
  }
  return { files, skipped };
}

async function main(): Promise<void> {
  loadEnvFiles();
  const dryRun = process.argv.includes("--dry-run");
  const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;

  const pool = new Pool({ connectionString: requireEnv("DATABASE_URL") });
  const db = drizzle(pool);

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${requireEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
  const bucket = requireEnv("R2_BUCKET");

  const { files, skipped: skippedNonImage } = listSeedFiles();
  const productRows = await db
    .select({ id: products.id, sku: products.sku, namePt: products.namePt, nameEn: products.nameEn })
    .from(products);
  const productBySku = new Map(productRows.map((row) => [row.sku, row]));

  // Match exato (stem === sku) ou por prefixo numérico p/ variantes com sufixo.
  type MatchedFile = SeedFile & { matchedSku: string; exact: boolean };
  const matched: MatchedFile[] = [];
  const unmatchedFiles: string[] = [];
  for (const file of files) {
    if (productBySku.has(file.sku)) {
      matched.push({ ...file, matchedSku: file.sku, exact: true });
      continue;
    }
    const prefix = /^(\d{3,})/.exec(file.sku)?.[1];
    if (prefix && prefix !== file.sku && productBySku.has(prefix)) {
      matched.push({ ...file, matchedSku: prefix, exact: false });
      continue;
    }
    unmatchedFiles.push(file.filename);
  }

  // sortOrder por produto: arquivo exato primeiro (imagem padrão), depois
  // variantes em ordem alfabética estável.
  const byProduct = new Map<string, MatchedFile[]>();
  for (const file of matched) {
    const group = byProduct.get(file.matchedSku) ?? [];
    group.push(file);
    byProduct.set(file.matchedSku, group);
  }
  const sortOrderByFilename = new Map<string, number>();
  for (const group of byProduct.values()) {
    group.sort((a, b) =>
      a.exact !== b.exact
        ? Number(b.exact) - Number(a.exact)
        : a.filename.localeCompare(b.filename, "en", { numeric: true })
    );
    group.forEach((file, index) => sortOrderByFilename.set(file.filename, index));
  }

  const matchedSkus = new Set(matched.map((file) => file.matchedSku));
  const productsWithoutFile = productRows.filter((row) => !matchedSkus.has(row.sku)).length;
  const oversize = matched.filter((file) => file.sizeBytes > MAX_IMAGE_BYTES);
  const variantCount = matched.filter((file) => !file.exact).length;

  console.log(`[import-images] ${files.length} arquivos de imagem em docs/PRODUTOS`);
  console.log(`[import-images] ${matched.length} atribuídos a ${matchedSkus.size} produtos (${variantCount} variantes por prefixo); ${unmatchedFiles.length} sem produto; ${productsWithoutFile} produtos sem arquivo`);
  if (skippedNonImage.length > 0) {
    console.log(`[import-images] ignorados (não-imagem): ${skippedNonImage.join(", ")}`);
  }
  if (unmatchedFiles.length > 0) {
    console.log(`[import-images] sem produto correspondente: ${unmatchedFiles.join(", ")}`);
  }
  if (oversize.length > 0) {
    console.log(`[import-images] AVISO — acima de 10MB (pulados): ${oversize.map((f) => f.filename).join(", ")}`);
  }

  const queue = matched.filter((file) => file.sizeBytes <= MAX_IMAGE_BYTES).slice(0, limit);
  let uploaded = 0;
  let alreadySeeded = 0;
  let failed = 0;

  async function processFile(file: MatchedFile): Promise<void> {
    const product = productBySku.get(file.matchedSku)!;

    const existing = await db
      .select({ id: productImages.id })
      .from(productImages)
      .where(and(eq(productImages.productId, product.id), eq(productImages.filename, file.filename)))
      .limit(1);
    if (existing.length > 0) {
      alreadySeeded++;
      return;
    }

    if (dryRun) {
      uploaded++;
      return;
    }

    // Mesmo esquema de chave do presign do portal: products/{sku}/{uuid}.{ext}
    const key = `products/${product.sku}/${crypto.randomUUID()}${file.extension}`;
    const body = fs.readFileSync(path.join(IMAGES_DIR, file.filename));

    let lastError: unknown;
    for (let attempt = 0; attempt <= UPLOAD_RETRIES; attempt++) {
      try {
        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: file.contentType,
          })
        );
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
    if (lastError) {
      failed++;
      console.error(`[import-images] FALHA no upload de ${file.filename}:`, lastError);
      return;
    }

    await db.insert(productImages).values({
      productId: product.id,
      r2Key: key,
      filename: file.filename,
      contentType: file.contentType,
      sizeBytes: file.sizeBytes,
      altPt: product.namePt,
      altEn: product.nameEn ?? null,
      sortOrder: sortOrderByFilename.get(file.filename) ?? 0,
    });
    uploaded++;
    if (uploaded % 50 === 0) {
      console.log(`[import-images] ${uploaded}/${queue.length} enviados...`);
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length > 0) {
      const file = queue.shift();
      if (!file) break;
      await processFile(file);
    }
  });
  await Promise.all(workers);

  console.log(
    `[import-images] ${dryRun ? "DRY-RUN — seriam enviados" : "enviados"}: ${uploaded} | já registrados (pulados): ${alreadySeeded} | falhas: ${failed}`
  );
  await pool.end();
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("[import-images] FALHOU:", error);
  process.exit(1);
});
