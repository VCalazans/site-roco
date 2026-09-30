import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { db as dbClient } from "@/db";
import { productImages, products } from "@/db/schema";
import { parseProductFilters, toProductListInput } from "@/modules/portal/lib/product-filters";
import { IMAGES_ZIP_MAX_FILES, PRODUCT_IMAGES_ZIP_PRODUCT_PARAM } from "@/modules/portal/lib/product-images";
import {
  portalProductConditions,
  portalProductFiltersSchema,
  type PortalProductFilters,
} from "./portal-product-filters";
import type { ZipImageRow } from "./zip-entry-names";

type Database = typeof dbClient;

export type ImagesZipScope =
  | { kind: "product"; productId: string }
  | { kind: "filters"; filters: PortalProductFilters }
  | { kind: "invalid" };

/**
 * O que o ZIP leva, pela URL: um produto (`?product=<id>`) ou os MESMOS
 * parâmetros de filtro da tabela do portal (lidos pelas mesmas funções) — sem
 * filtro, o catálogo inteiro.
 */
export function resolveImagesZipScope(params: URLSearchParams): ImagesZipScope {
  const productParam = params.get(PRODUCT_IMAGES_ZIP_PRODUCT_PARAM);
  if (productParam !== null) {
    const productId = z.string().uuid().safeParse(productParam);
    return productId.success ? { kind: "product", productId: productId.data } : { kind: "invalid" };
  }
  const filters = portalProductFiltersSchema.safeParse(toProductListInput(parseProductFilters(params)));
  return filters.success ? { kind: "filters", filters: filters.data } : { kind: "invalid" };
}

export type ImagesZipRow = ZipImageRow & { sizeBytes: number };

/**
 * Imagens de produtos ATIVOS do escopo, na ordem do ZIP: produto (SKU), depois
 * a ordem de exibição (a capa primeiro). Traz no máximo
 * `IMAGES_ZIP_MAX_FILES + 1` linhas — o bastante para a rota saber que passou
 * do limite sem carregar um catálogo gigante na memória.
 */
export async function loadImagesZipRows(
  db: Database,
  scope: Exclude<ImagesZipScope, { kind: "invalid" }>
): Promise<ImagesZipRow[]> {
  const where =
    scope.kind === "product"
      ? and(eq(products.id, scope.productId), eq(products.active, true))
      : portalProductConditions(db, scope.filters);

  return db
    .select({
      productId: products.id,
      sku: products.sku,
      namePt: products.namePt,
      r2Key: productImages.r2Key,
      filename: productImages.filename,
      contentType: productImages.contentType,
      sizeBytes: productImages.sizeBytes,
      createdAt: productImages.createdAt,
    })
    .from(products)
    .innerJoin(productImages, eq(productImages.productId, products.id))
    .where(where)
    .orderBy(asc(products.sku), asc(productImages.sortOrder), asc(productImages.createdAt))
    .limit(IMAGES_ZIP_MAX_FILES + 1);
}

/** Uma imagem de produto ativo, para o download avulso (`null` = não existe). */
export async function loadDownloadableImage(db: Database, imageId: string) {
  const [image] = await db
    .select({ r2Key: productImages.r2Key, filename: productImages.filename })
    .from(productImages)
    .innerJoin(products, eq(products.id, productImages.productId))
    .where(and(eq(productImages.id, imageId), eq(products.active, true)))
    .limit(1);
  return image ?? null;
}
