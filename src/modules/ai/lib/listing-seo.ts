/**
 * Indexação da listagem `/produtos` (spec 003). Cada combinação de filtros é
 * uma URL diferente; sem regra, o buscador indexaria milhares de páginas quase
 * iguais. Regra:
 * - sem filtro → página do catálogo (canonical sem querystring);
 * - UMA categoria, sem busca e sem "só campeões" → página da categoria,
 *   indexável (`?category=gas`), também no sitemap;
 * - busca livre, várias categorias ou "só campeões" → `noindex, follow` (o robô
 *   segue os links para os produtos, mas não indexa a combinação);
 * - página N > 1 entra no canonical (cada página lista produtos diferentes).
 *
 * Puro: recebe o estado já normalizado por `readListingState`.
 */
export type ListingIndexing = {
  index: boolean;
  /** Querystring do canonical, com `?` (ou vazia). */
  query: string;
  /** Categoria da página indexável, quando há. */
  category: string | null;
};

export function listingIndexing(state: {
  searchTerms: readonly string[];
  categories: readonly string[];
  bestSeller: boolean;
  page: number;
}): ListingIndexing {
  const pageParam = state.page > 1 ? `page=${state.page}` : "";

  if (state.searchTerms.length > 0 || state.categories.length > 1 || state.bestSeller) {
    return { index: false, query: "", category: null };
  }

  const category = state.categories[0] ?? null;
  const params = [category ? `category=${encodeURIComponent(category)}` : "", pageParam].filter(Boolean);
  return { index: true, query: params.length > 0 ? `?${params.join("&")}` : "", category };
}
