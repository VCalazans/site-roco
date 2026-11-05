/**
 * Arquivo do catálogo em PDF enviado pelo portal (Configurações do Site ›
 * Catálogo em PDF). Fica gravado em `site_settings` (`catalog.file`), como um
 * documento só: o catálogo é único, não uma coleção.
 *
 * Puro e sem I/O: usado pelo router do portal e pela rota de download.
 */
import { z } from "zod";

/** Prefixo com leitura pública no bucket (ver techContext › Buckets). */
export const CATALOG_FILE_KEY_PREFIX = "site/catalogo/";

const CATALOG_FILE_KEY =
  /^site\/catalogo\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/;

/** Só chave gerada pelo presign: nada de apontar o catálogo para outro objeto do bucket. */
export function isCatalogFileKey(key: string): boolean {
  return CATALOG_FILE_KEY.test(key);
}

export const catalogFileSchema = z.object({
  key: z.string().refine(isCatalogFileKey),
  filename: z.string().min(1).max(255),
  sizeBytes: z.number().int().positive(),
  updatedAt: z.string().min(1),
});

export type CatalogFile = z.infer<typeof catalogFileSchema>;

/** Leitura tolerante do valor salvo: formato inesperado conta como "sem arquivo". */
export function parseCatalogFile(raw: string | null | undefined): CatalogFile | null {
  if (!raw) return null;
  try {
    const parsed = catalogFileSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
