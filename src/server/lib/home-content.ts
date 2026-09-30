import "server-only";
import { inArray } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { getPublicUrl } from "@/core/storage/r2";
import { db } from "@/db";
import { siteSettings } from "@/db/schema/site-settings";
import type { Locale } from "@/i18n/config";
import {
  EMPTY_HOME_DOCUMENTS,
  HOME_CONTENT_KEYS,
  parseHomeRows,
  resolveHomeContent,
  type HomeContentDocuments,
  type HomeDictionary,
  type ResolvedHomeContent,
} from "@/modules/home/lib/home-content";

/** Tag de cache do conteúdo da home — revalidada por toda mutação de `homeContent`. */
export const HOME_CONTENT_CACHE_TAG = "home-content";

const HOME_KEYS = Object.values(HOME_CONTENT_KEYS);

/** URL pública de uma chave R2, tolerante a `R2_PUBLIC_URL` ausente (dev). */
export function safeHomeImageUrl(key: string): string | null {
  try {
    return getPublicUrl(key);
  } catch {
    return null;
  }
}

async function readHomeDocuments(): Promise<HomeContentDocuments> {
  const rows = await db
    .select({ key: siteSettings.key, value: siteSettings.value })
    .from(siteSettings)
    .where(inArray(siteSettings.key, HOME_KEYS));
  return parseHomeRows(rows);
}

/**
 * Documentos da home, cacheados (tag `home-content`). Uma leitura só para as
 * seis chaves — a home não ganha round-trip por seção (spec 001, RNF01).
 */
const getCachedHomeDocuments = unstable_cache(readHomeDocuments, ["home-content", "documents"], {
  tags: [HOME_CONTENT_CACHE_TAG],
  revalidate: 300,
});

/**
 * Conteúdo da home pronto para renderizar no idioma pedido. Se o banco estiver
 * indisponível, cai inteiro no padrão do dicionário em vez de derrubar a
 * página — a home é a última coisa que pode quebrar por conteúdo editável.
 */
export async function getHomeContent(locale: Locale, defaults: HomeDictionary): Promise<ResolvedHomeContent> {
  let documents: HomeContentDocuments = EMPTY_HOME_DOCUMENTS;
  try {
    documents = await getCachedHomeDocuments();
  } catch (error) {
    console.error("[home-content] Falha ao ler o conteúdo editável — usando o padrão do dicionário.", error);
  }
  return resolveHomeContent({ documents, locale, defaults, imageUrl: safeHomeImageUrl });
}
