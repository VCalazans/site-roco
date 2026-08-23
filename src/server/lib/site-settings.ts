import "server-only";
import { and, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db as dbClient } from "@/db";
import {
  SITE_SETTING_CATALOG_PDF_URL,
  siteSettings,
} from "@/db/schema/site-settings";
import { getPublicUrl } from "@/core/storage/r2";

type Database = typeof dbClient;

/**
 * Lê uma configuração pública (`is_public = true`). Cache de 60s com tag
 * `"site-settings"` (revalidada por mutações do admin — mesmo padrão do
 * `products`/`hero`). Fallback para env quando não houver linha no banco
 * (dev sem seed).
 */
async function readSetting(
  key: string,
  db: Database = dbClient
): Promise<string | null> {
  const [row] = await db
    .select({ value: siteSettings.value })
    .from(siteSettings)
    .where(and(eq(siteSettings.key, key), eq(siteSettings.isPublic, true)))
    .limit(1);
  if (!row) return null;
  const v = row.value as unknown;
  return typeof v === "string" ? v : v == null ? null : String(v);
}

/**
 * URL do PDF de catálogo, com fallback em camadas:
 *   1. Linha `catalog.pdf-url` em `site_settings` (admin editou).
 *   2. `NEXT_PUBLIC_CATALOG_PDF_URL` (env em build-time).
 *   3. `siteLinks.catalogPdf` (constante de fallback — `/downloads/catalogo-roco-2026.pdf`).
 *
 * O `R2_PUBLIC_URL` é resolvido em runtime para refletir trocas sem
 * rebuild (mesmo padrão de `getPublicUrl`).
 */
export async function getCatalogPdfUrl(): Promise<string> {
  const fromDb = await cachedReadSetting(SITE_SETTING_CATALOG_PDF_URL);
  if (fromDb) {
    // Mesmo esquema de fallback da `siteLinks.catalogPdf`: se a string já
    // for absoluta (`https://...`), usa direto; senão prefixa `R2_PUBLIC_URL`.
    if (/^https?:\/\//.test(fromDb)) return fromDb;
    try {
      return getPublicUrl(fromDb.replace(/^\//, ""));
    } catch {
      return fromDb;
    }
  }
  const fromEnv = process.env.NEXT_PUBLIC_CATALOG_PDF_URL;
  if (fromEnv) return fromEnv;
  // Fallback final: constante do projeto (mesma string que `siteLinks.catalogPdf`).
  return "/downloads/catalogo-roco-2026.pdf";
}

/** Versão cacheada do reader genérico (chaveada por key). */
const cachedReadSetting = (key: string) =>
  unstable_cache(
    async () => readSetting(key),
    ["site-settings", key],
    { revalidate: 60, tags: ["site-settings"] }
  )();
