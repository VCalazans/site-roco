/**
 * Paginação das listas do portal — regras puras (sem React/Next), usadas pelo
 * componente `PortalPagination`, pela página de produtos (que guarda a página
 * na URL) e pelo servidor (`products.list`, que limita a página pedida ao
 * intervalo real). Páginas começam em 1 em todo o código da aplicação; só o
 * `TablePagination` do MUI conta a partir de 0, e a conversão fica no
 * componente.
 */

export const PORTAL_PER_PAGE_OPTIONS = [20, 50, 100] as const;
export const DEFAULT_PORTAL_PER_PAGE = 20;

export const PAGE_PARAM = "page";
export const PER_PAGE_PARAM = "perPage";

export type Paging = { page: number; perPage: number };

/** Total de páginas (nunca menos que 1: lista vazia ainda tem a página 1). */
export function pageCountOf(total: number, perPage: number): number {
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(perPage) || perPage <= 0) return 1;
  return Math.ceil(total / perPage);
}

/** Página dentro de `1..pageCount` — pedir a página 999 de 37 devolve a 37. */
export function clampPage(page: number, total: number, perPage: number): number {
  const safe = Number.isFinite(page) ? Math.floor(page) : 1;
  return Math.min(Math.max(1, safe), pageCountOf(total, perPage));
}

/** O que `URLSearchParams` e o `ReadonlyURLSearchParams` do Next têm em comum. */
type ParamsReader = { get(name: string): string | null };

/**
 * Lê a paginação da URL. Tolerante: `?page=abc`, página negativa ou um
 * tamanho que a interface não oferece caem no padrão, em vez de chegar ao
 * servidor como erro de validação.
 */
export function parsePaging(
  params: ParamsReader,
  perPageOptions: readonly number[] = PORTAL_PER_PAGE_OPTIONS,
  defaultPerPage: number = DEFAULT_PORTAL_PER_PAGE
): Paging {
  const page = Number(params.get(PAGE_PARAM));
  const perPage = Number(params.get(PER_PAGE_PARAM));
  return {
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    perPage: perPageOptions.includes(perPage) ? perPage : defaultPerPage,
  };
}

/**
 * Cópia de `base` com a paginação aplicada. Os valores padrão (página 1,
 * tamanho padrão) saem da URL, mantendo-a curta; os demais parâmetros passam
 * intactos.
 */
export function applyPaging(
  base: URLSearchParams,
  paging: Paging,
  defaultPerPage: number = DEFAULT_PORTAL_PER_PAGE
): URLSearchParams {
  const next = new URLSearchParams(base);
  next.delete(PAGE_PARAM);
  next.delete(PER_PAGE_PARAM);
  if (paging.page > 1) next.set(PAGE_PARAM, String(paging.page));
  if (paging.perPage !== defaultPerPage) next.set(PER_PAGE_PARAM, String(paging.perPage));
  return next;
}
