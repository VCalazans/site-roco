/**
 * Resolução de destino dos cards curados da vitrine de categorias da home.
 *
 * Os 6 cards vêm do PSD "Layout pag Produtos_OK_01.psd" (macro-famílias de
 * marketing aprovadas pelo stakeholder), não das categorias do ERP — o mapa
 * card→filtro vive nos dicionários (`home.categories.items[].href`). Como o
 * catálogo pode ser re-importado/renomeado, um href `?category=<slug>` cuja
 * categoria não existe mais degradaria para uma listagem vazia; aqui ele cai
 * para a listagem completa em vez disso. Hrefs com `?search=` não são
 * validados (busca vazia é um estado navegável e legítimo da listagem).
 */
export function resolveCategoryCardHref(
  href: string,
  locale: string,
  existingCategorySlugs: readonly string[]
): string {
  const queryIndex = href.indexOf("?");
  const path = queryIndex === -1 ? href : href.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : href.slice(queryIndex + 1);

  const categoryMatch = /(?:^|&)category=([^&]*)/.exec(query);
  if (categoryMatch) {
    let slug: string | null = null;
    try {
      slug = decodeURIComponent(categoryMatch[1]);
    } catch {
      // percent-encoding malformado no dicionário (ex.: "50%") não pode
      // derrubar o SSR da home — trata como categoria inexistente.
    }
    if (slug === null || !existingCategorySlugs.includes(slug)) {
      return `/${locale}${path}`;
    }
  }

  return `/${locale}${href}`;
}
