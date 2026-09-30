/**
 * Filtros da listagem de produtos do portal, espelhados na URL de
 * `/portal/produtos` (spec 001, RF26). A URL é a fonte de verdade: a busca da
 * sidebar, os indicadores do painel e um link colado no WhatsApp abrem a lista
 * já filtrada, e o botão "voltar" do navegador funciona.
 *
 * Módulo puro (sem React/Next) para ser testável — os nomes de parâmetro ficam
 * todos aqui, e o painel monta seus links por `buildProductsHref` em vez de
 * concatenar strings.
 *
 *   ?search=joelho            busca em SKU / nome PT / nome EN
 *   ?category=<uuid>          categoria
 *   ?status=published         publicados (ou `unpublished`); ausente = todos
 *   ?filter=featured          filtros rápidos, repetíveis:
 *   ?filter=bestSeller          destaques da home / campeões de vendas / sem foto
 *   ?filter=noImage             ("sem foto" = nenhuma imagem marcada para o site)
 *   ?page=2&perPage=50        paginação (ver `./pagination`) — mudar filtro volta à página 1
 *   ?new=1                    abre o diálogo de novo produto (atalho do painel)
 */
import { PAGE_PARAM } from "./pagination";

export type ProductStatusFilter = "all" | "published" | "unpublished";
export type ProductQuickFilter = "featured" | "bestSeller" | "noImage";

/** Ordem canônica dos filtros rápidos (a mesma dos chips e da URL gerada). */
export const PRODUCT_QUICK_FILTERS: readonly ProductQuickFilter[] = [
  "featured",
  "bestSeller",
  "noImage",
];

export type ProductFilters = {
  search: string;
  /** `""` = todas as categorias. */
  categoryId: string;
  status: ProductStatusFilter;
  quick: ProductQuickFilter[];
};

export const EMPTY_PRODUCT_FILTERS: ProductFilters = {
  search: "",
  categoryId: "",
  status: "all",
  quick: [],
};

export const PRODUCT_SEARCH_PARAM = "search";
export const PRODUCT_CATEGORY_PARAM = "category";
export const PRODUCT_STATUS_PARAM = "status";
export const PRODUCT_QUICK_PARAM = "filter";
export const PRODUCT_NEW_PARAM = "new";

const FILTER_PARAMS = [
  PRODUCT_SEARCH_PARAM,
  PRODUCT_CATEGORY_PARAM,
  PRODUCT_STATUS_PARAM,
  PRODUCT_QUICK_PARAM,
] as const;

/** Teto do servidor para `products.list` (`search.max(200)`). */
export const PRODUCT_SEARCH_MAX_LENGTH = 200;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** O que `URLSearchParams` e o `ReadonlyURLSearchParams` do Next têm em comum. */
export type ParamsReader = {
  get(name: string): string | null;
  getAll(name: string): string[];
};

/**
 * Lê os filtros da URL. Tolerante de propósito: a URL é entrada de usuário
 * (link antigo, digitado à mão), então valor desconhecido vira o padrão em vez
 * de quebrar a consulta — em particular um `category` que não é UUID, que o
 * servidor rejeitaria com erro de validação.
 */
export function parseProductFilters(params: ParamsReader): ProductFilters {
  const search = (params.get(PRODUCT_SEARCH_PARAM) ?? "")
    .trim()
    .slice(0, PRODUCT_SEARCH_MAX_LENGTH);

  const categoryRaw = (params.get(PRODUCT_CATEGORY_PARAM) ?? "").trim();
  const categoryId = UUID_PATTERN.test(categoryRaw) ? categoryRaw : "";

  const statusRaw = params.get(PRODUCT_STATUS_PARAM);
  const status: ProductStatusFilter =
    statusRaw === "published" || statusRaw === "unpublished" ? statusRaw : "all";

  // Aceita `?filter=a&filter=b` e `?filter=a,b`.
  const requested = new Set(
    params
      .getAll(PRODUCT_QUICK_PARAM)
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
  );
  const quick = PRODUCT_QUICK_FILTERS.filter((filter) => requested.has(filter));

  return { search, categoryId, status, quick };
}

/**
 * Devolve uma cópia de `base` com os filtros aplicados. Parâmetros que não são
 * de filtro (ex.: `new`, `perPage`) passam intactos; os de filtro são sempre
 * reescritos — e os que estão no padrão saem da URL, mantendo-a curta. A
 * página sai sempre: filtro novo recomeça na página 1 (a 5ª página de outro
 * filtro pode nem existir neste).
 */
export function applyProductFilters(
  base: URLSearchParams,
  filters: ProductFilters
): URLSearchParams {
  const next = new URLSearchParams(base);
  for (const name of FILTER_PARAMS) next.delete(name);
  next.delete(PAGE_PARAM);

  if (filters.search) next.set(PRODUCT_SEARCH_PARAM, filters.search);
  if (filters.categoryId) next.set(PRODUCT_CATEGORY_PARAM, filters.categoryId);
  if (filters.status !== "all") next.set(PRODUCT_STATUS_PARAM, filters.status);
  for (const filter of filters.quick) next.append(PRODUCT_QUICK_PARAM, filter);

  return next;
}

export function hasActiveProductFilters(filters: ProductFilters): boolean {
  return (
    filters.search !== "" ||
    filters.categoryId !== "" ||
    filters.status !== "all" ||
    filters.quick.length > 0
  );
}

/** Liga/desliga um filtro rápido, mantendo a ordem canônica. */
export function toggleQuickFilter(
  filters: ProductFilters,
  filter: ProductQuickFilter
): ProductFilters {
  const active = new Set(filters.quick);
  if (active.has(filter)) active.delete(filter);
  else active.add(filter);
  return { ...filters, quick: PRODUCT_QUICK_FILTERS.filter((item) => active.has(item)) };
}

/** Filtros de `trpc.products.list`/`imagesSummary` e do ZIP de imagens (sem paginação). */
export function toProductListInput(filters: ProductFilters) {
  return {
    search: filters.search || undefined,
    categoryId: filters.categoryId || undefined,
    published: filters.status === "all" ? undefined : filters.status === "published",
    featured: filters.quick.includes("featured") ? true : undefined,
    bestSeller: filters.quick.includes("bestSeller") ? true : undefined,
    // "Sem foto" = nenhuma imagem marcada para o site; desligado NÃO é `true` (não exige foto).
    hasSiteImage: filters.quick.includes("noImage") ? false : undefined,
  };
}

/**
 * Link para a listagem já filtrada — usado pelos indicadores do painel.
 * `productsPath` é o caminho do portal (`/pt/portal/produtos`).
 */
export function buildProductsHref(
  productsPath: string,
  filters: Partial<ProductFilters> = {},
  options: { openNew?: boolean } = {}
): string {
  const params = applyProductFilters(new URLSearchParams(), {
    ...EMPTY_PRODUCT_FILTERS,
    ...filters,
  });
  if (options.openNew) params.set(PRODUCT_NEW_PARAM, "1");
  const query = params.toString();
  return query ? `${productsPath}?${query}` : productsPath;
}
