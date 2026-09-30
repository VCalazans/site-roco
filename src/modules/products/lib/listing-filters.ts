/**
 * Filtros da listagem pública de produtos (`/produtos` e `GET /api/products`)
 * — regras puras, compartilhadas pelo servidor (leitura da querystring) e pelo
 * explorador (montagem da URL, chips e caixas de categoria). Sem banco, sem
 * DOM: testáveis isoladamente.
 *
 * Semântica (pedido do stakeholder em 2026-09-30: vários filtros ao mesmo tempo):
 * - CATEGORIAS: qualquer uma das marcadas (OU). Marcar "Gás" e "Conexões"
 *   mostra os produtos das duas — é o que se espera de uma lista de caixas.
 * - TERMOS DE BUSCA: todos (E). Enter fixa o termo digitado como um chip e
 *   libera o campo; o termo seguinte REFINA o resultado ("engate" + "40").
 *   O texto ainda no campo filtra ao vivo como mais um termo, então fixá-lo
 *   não muda o resultado — só libera o campo.
 * - Entre grupos (busca × categorias × campeões): E.
 *
 * Na URL cada valor é um parâmetro repetido (`?category=gas&category=conexoes
 * &search=engate&search=40`), o formato nativo de `URLSearchParams.getAll` e
 * dos `searchParams` do App Router — links antigos com um valor só continuam
 * valendo sem conversão.
 */

/** Termos fixados (chips) por busca. */
export const MAX_SEARCH_CHIPS = 5;
/** Valores de `search` aceitos na querystring: os chips + o texto ainda no campo. */
export const MAX_SEARCH_VALUES = MAX_SEARCH_CHIPS + 1;
/** Teto de CADA termo — limita o custo do LIKE com texto do usuário. */
export const MAX_SEARCH_LENGTH = 80;
/** Teto de categorias lidas da querystring (o catálogo tem ~16; o excedente é descartado). */
export const MAX_CATEGORY_VALUES = 32;

export type ListingFilters = {
  searchTerms: string[];
  categories: string[];
  bestSeller: boolean;
};

/** Chave de comparação de termos: minúsculas, sem acento, espaços colapsados. */
export function termKey(term: string): string {
  return term
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Um termo como será usado: espaços colapsados, sem bordas, no máximo `MAX_SEARCH_LENGTH`. */
export function cleanTerm(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_SEARCH_LENGTH).trim();
}

function includesTerm(terms: readonly string[], term: string): boolean {
  const key = termKey(term);
  return terms.some((existing) => termKey(existing) === key);
}

/**
 * Termos vindos da querystring: limpos, sem vazios, sem repetidos (ignorando
 * acento e caixa — "gás" e "GAS" são o mesmo filtro) e no máximo
 * `MAX_SEARCH_VALUES`, na ordem em que chegaram.
 */
export function normalizeSearchTerms(values: readonly string[]): string[] {
  const result: string[] = [];
  for (const value of values) {
    const term = cleanTerm(value);
    if (!term || includesTerm(result, term)) continue;
    result.push(term);
    if (result.length === MAX_SEARCH_VALUES) break;
  }
  return result;
}

/**
 * Slugs de categoria vindos da querystring: sem vazios, sem repetidos, no
 * máximo `MAX_CATEGORY_VALUES`. Validar contra o catálogo é papel do servidor.
 */
export function normalizeCategorySlugs(values: readonly string[]): string[] {
  const unique = new Set<string>();
  for (const value of values) {
    const slug = value.trim();
    if (slug) unique.add(slug);
    if (unique.size === MAX_CATEGORY_VALUES) break;
  }
  return [...unique];
}

/** Valor de `searchParams` do App Router: um, vários (parâmetro repetido) ou nenhum. */
export function paramValues(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** Só "1"/"true" ligam o filtro de campeões (mesma regra no SSR e na API). */
export function parseBestSeller(value: string | null | undefined): boolean {
  return value === "1" || value === "true";
}

export type CommitTermResult = {
  /** `added`: virou chip · `duplicate`: já era chip (o campo só é liberado) · `empty`: nada a fixar · `limit`: teto de chips. */
  status: "added" | "duplicate" | "empty" | "limit";
  terms: string[];
};

/** Enter no campo de busca: fixa o texto digitado como mais um termo (chip). */
export function commitSearchTerm(terms: readonly string[], draft: string): CommitTermResult {
  const term = cleanTerm(draft);
  if (!term) return { status: "empty", terms: [...terms] };
  if (includesTerm(terms, term)) return { status: "duplicate", terms: [...terms] };
  if (terms.length >= MAX_SEARCH_CHIPS) return { status: "limit", terms: [...terms] };
  return { status: "added", terms: [...terms, term] };
}

/** Termos que filtram de fato: os fixados + o texto ainda no campo (se não repetir um fixado). */
export function effectiveSearchTerms(terms: readonly string[], draft: string): string[] {
  const term = cleanTerm(draft);
  if (!term || includesTerm(terms, term)) return [...terms];
  return [...terms, term];
}

/** Ordena slugs pela ordem do catálogo; slug fora dela vai para o fim. */
export function sortByOrder(slugs: readonly string[], order: readonly string[]): string[] {
  const position = new Map(order.map((slug, index) => [slug, index]));
  const rank = (slug: string) => position.get(slug) ?? order.length;
  return [...slugs].sort((a, b) => rank(a) - rank(b));
}

/**
 * Marca/desmarca uma categoria mantendo a ORDEM DO CATÁLOGO (a mesma da barra
 * lateral): a URL e os chips não dependem da ordem dos cliques.
 */
export function toggleCategory(selected: readonly string[], slug: string, order: readonly string[]): string[] {
  const next = new Set(selected);
  if (next.has(slug)) next.delete(slug);
  else next.add(slug);
  return sortByOrder([...next], order);
}

/** Querystring da listagem — URL da página (sem `perPage`) e `GET /api/products`. */
export function buildListingQuery(
  filters: ListingFilters & { page?: number; perPage?: number }
): URLSearchParams {
  const qs = new URLSearchParams();
  for (const term of filters.searchTerms) qs.append("search", term);
  for (const slug of filters.categories) qs.append("category", slug);
  if (filters.bestSeller) qs.set("bestSeller", "1");
  if (filters.page && filters.page > 1) qs.set("page", String(filters.page));
  if (filters.perPage) qs.set("perPage", String(filters.perPage));
  return qs;
}

export function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** Filtros + página, como a listagem os lê da URL. */
export type ListingState = ListingFilters & { page: number };

/** O que `URLSearchParams` e o `useSearchParams` do App Router oferecem em comum. */
type SearchParamsReader = {
  get(name: string): string | null;
  getAll(name: string): string[];
};

/**
 * Lê a URL da listagem com as MESMAS regras no SSR (página `/produtos`) e no
 * explorador (`useSearchParams`) — os dois precisam chegar ao mesmo estado,
 * senão a hidratação diverge. Categorias: só as de `categoryOrder` (as que
 * existem), na ordem do catálogo — link de categoria removida mostra o
 * catálogo inteiro em vez de um filtro "fantasma" que a barra lateral não tem
 * como exibir nem desmarcar.
 */
export function readListingState(params: SearchParamsReader, categoryOrder: readonly string[]): ListingState {
  const requested = new Set(normalizeCategorySlugs(params.getAll("category")));
  const page = Number(params.get("page"));
  return {
    searchTerms: normalizeSearchTerms(params.getAll("search")),
    categories: categoryOrder.filter((slug) => requested.has(slug)),
    bestSeller: parseBestSeller(params.get("bestSeller")),
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
  };
}

/**
 * A renderização do servidor corresponde à URL? Em voltar/avançar o roteador
 * do App Router restaura a renderização em CACHE, que pode ser anterior às
 * mudanças de filtro feitas no cliente (a URL foi reescrita com
 * `history.replaceState`) — aí os itens recebidos não servem e é preciso
 * buscar de novo. Página além do fim conta como a mesma quando o servidor a
 * limitou à última página real.
 */
export function matchesServerRender(url: ListingState, server: ListingState, serverTotalPages: number): boolean {
  const samePage = url.page === server.page || (url.page > serverTotalPages && server.page === serverTotalPages);
  return (
    samePage &&
    sameList(url.searchTerms, server.searchTerms) &&
    sameList(url.categories, server.categories) &&
    url.bestSeller === server.bestSeller
  );
}
