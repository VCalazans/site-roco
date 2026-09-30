/**
 * Regras das imagens de produto — puras, compartilhadas pelo portal
 * (gerenciador de imagens do cadastro e galeria de download) e pelo servidor
 * (router `products`, que reordena ao escolher a capa).
 *
 * - Cada imagem é marcada para aparecer no site ou não; TODAS (inclusive as
 *   que não vão ao site) ficam disponíveis para download no portal.
 * - A ordem de exibição é `sortOrder`; a CAPA do site (imagem da listagem e
 *   primeira da galeria) é a primeira imagem visível nessa ordem.
 */

import { applyProductFilters, type ProductFilters } from "./product-filters";

/**
 * Limites de um ZIP em lote. O catálogo inteiro hoje tem ~600 imagens e
 * ~340 MB, bem abaixo: o teto existe para um catálogo que cresça muito, e aí a
 * tela pede para filtrar (por categoria, por exemplo) antes de baixar.
 */
export const IMAGES_ZIP_MAX_FILES = 3000;
export const IMAGES_ZIP_MAX_BYTES = 2 * 1024 * 1024 * 1024;

export function exceedsZipLimits(summary: { imageCount: number; totalBytes: number }): boolean {
  return summary.imageCount > IMAGES_ZIP_MAX_FILES || summary.totalBytes > IMAGES_ZIP_MAX_BYTES;
}

/**
 * Rotas de download (autenticadas: sessão + `product_images:download` no
 * clique). O ZIP aceita um produto (`?product=<id>`) ou os MESMOS parâmetros de
 * filtro da tabela — o que a pessoa vê filtrado é o que ela baixa.
 */
export const PRODUCT_IMAGES_ZIP_PATH = "/api/portal/products/images/zip";
export const PRODUCT_IMAGES_ZIP_PRODUCT_PARAM = "product";

/** Download de UMA imagem, original, com o nome do upload. */
export function productImageDownloadHref(imageId: string): string {
  return `/api/portal/products/images/${encodeURIComponent(imageId)}/download`;
}

/** ZIP com todas as imagens (originais) de um produto. */
export function productImagesZipHref(productId: string): string {
  const params = new URLSearchParams({ [PRODUCT_IMAGES_ZIP_PRODUCT_PARAM]: productId });
  return `${PRODUCT_IMAGES_ZIP_PATH}?${params.toString()}`;
}

/** ZIP com as imagens de todos os produtos do filtro (sem filtro: o catálogo inteiro). */
export function filteredImagesZipHref(filters: ProductFilters): string {
  const query = applyProductFilters(new URLSearchParams(), filters).toString();
  return query ? `${PRODUCT_IMAGES_ZIP_PATH}?${query}` : PRODUCT_IMAGES_ZIP_PATH;
}

export type SiteImageState = { id: string; showOnSite: boolean };

/** Capa do site: a primeira imagem visível na ordem recebida; `null` = produto sem foto no site. */
export function siteCoverId(images: readonly SiteImageState[]): string | null {
  return images.find((image) => image.showOnSite)?.id ?? null;
}

export function countSiteImages(images: readonly { showOnSite: boolean }[]): number {
  return images.filter((image) => image.showOnSite).length;
}

/** Nova ordem com `id` na frente; as demais mantêm a ordem relativa. Id desconhecido não muda nada. */
export function moveToFront(ids: readonly string[], id: string): string[] {
  if (!ids.includes(id)) return [...ids];
  return [id, ...ids.filter((item) => item !== id)];
}
