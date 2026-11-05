import "server-only";
import { and, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db as dbClient } from "@/db";
import {
  SITE_SETTING_CATALOG_FILE,
  SITE_SETTING_CONTACT_EMAIL,
  SITE_SETTING_CONTACT_PHONE,
  SITE_SETTING_CONTACT_ADDRESS_MATRIZ,
  SITE_SETTING_CONTACT_ADDRESS_FILIAL,
  SITE_SETTING_SOCIAL_LINKS,
  siteSettings,
} from "@/db/schema/site-settings";
import { parseCatalogFile, type CatalogFile } from "@/modules/catalog/lib/catalog-file";

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
  if (v == null) return null;
  if (typeof v === "string") return v;
  // Objeto/array: TEM de voltar a ser JSON, nunca `String(v)`.
  //
  // O valor faz uma volta a mais entre gravação e leitura: quem escreve manda
  // uma STRING (o seed manda `JSON.stringify({...})`; o `set` do tRPC valida
  // `z.string()`), a coluna é `jsonb` e o driver do Drizzle serializa de novo —
  // então o banco guarda um *JSON string*. Na leitura o node-postgres já
  // devolve o conteúdo e o `mapFromDriverValue` do jsonb faz `JSON.parse` mais
  // uma vez, entregando aqui um OBJETO.
  //
  // Com `String(v)` isso virava literalmente "[object Object]", o
  // `JSON.parse` de `getSocialLinks` lançava e o `catch` devolvia `{}`: a
  // linha de redes sociais do rodapé NUNCA renderizou desde que foi escrita
  // (verificado no HTML servido pelo container em 2026-08-30). As chaves de
  // texto simples sobreviviam por acidente, porque as duas transformações se
  // cancelam — `contact.phone` inclusive volta como NUMBER e cai no
  // `String(v)` final.
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/**
 * Catálogo enviado pelo portal, ou `null` enquanto ninguém enviou. A tag
 * `site-settings` é expirada na hora pelo upload.
 */
export async function getCatalogFile(): Promise<CatalogFile | null> {
  return parseCatalogFile(await cachedReadSetting(SITE_SETTING_CATALOG_FILE));
}

/** Versão cacheada do reader genérico (chaveada por key). */
const cachedReadSetting = (key: string) =>
  unstable_cache(
    async () => readSetting(key),
    ["site-settings", key],
    { revalidate: 60, tags: ["site-settings"] }
  )();

export type SocialLinks = {
  instagram?: string;
  linkedin?: string;
  youtube?: string;
  whatsapp?: string;
};

/**
 * Dados de contato da empresa, lidos do banco com fallback para string vazia.
 * Chamado pelo rodapé do site público.
 */
export async function getContactInfo(): Promise<{
  phone: string;
  email: string;
  addressMatriz: string;
  addressFilial: string;
}> {
  const [phone, email, addressMatriz, addressFilial] = await Promise.all([
    cachedReadSetting(SITE_SETTING_CONTACT_PHONE),
    cachedReadSetting(SITE_SETTING_CONTACT_EMAIL),
    cachedReadSetting(SITE_SETTING_CONTACT_ADDRESS_MATRIZ),
    cachedReadSetting(SITE_SETTING_CONTACT_ADDRESS_FILIAL),
  ]);
  return {
    phone: phone ?? "",
    email: email ?? "",
    addressMatriz: addressMatriz ?? "",
    addressFilial: addressFilial ?? "",
  };
}

/**
 * Links das redes sociais, lidos do banco. Cada campo é opcional — se não
 * existir, o ícone correspondente não é renderizado no rodapé.
 */
export async function getSocialLinks(): Promise<SocialLinks> {
  const raw = await cachedReadSetting(SITE_SETTING_SOCIAL_LINKS);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as SocialLinks;
  } catch {
    return {};
  }
}
