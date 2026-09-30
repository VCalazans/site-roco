/**
 * Faixa de páginas da paginação numerada da listagem (spec 001, RF14) —
 * `‹ 1 2 3 4 5 … 37 ›`, `‹ 1 … 18 19 20 … 37 ›`. Função PURA (testável sem DOM).
 *
 * Mesmo algoritmo do `usePagination` do MUI (uma página de borda de cada
 * lado): a QUANTIDADE de itens é constante (2 × vizinhos + 5), então a barra
 * não muda de largura ao navegar — os botões não "fogem" do cursor. Um buraco
 * de UMA página vira o próprio número (nunca `1 … 3`). Entrada fora do
 * intervalo é clampada.
 */
export type PaginationItem = number | "ellipsis-start" | "ellipsis-end";

export function buildPaginationRange(currentPage: number, totalPages: number, siblings = 1): PaginationItem[] {
  const total = Math.max(1, Math.floor(totalPages) || 1);
  const page = Math.min(Math.max(1, Math.floor(currentPage) || 1), total);
  const sibling = Math.max(0, Math.floor(siblings));
  const boundary = 1;

  if (total <= sibling * 2 + 5) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const siblingsStart = Math.max(Math.min(page - sibling, total - boundary - sibling * 2 - 1), boundary + 2);
  const siblingsEnd = Math.min(Math.max(page + sibling, boundary + sibling * 2 + 2), total - boundary - 1);

  const items: PaginationItem[] = [1];
  items.push(siblingsStart > boundary + 2 ? "ellipsis-start" : boundary + 1);
  for (let item = siblingsStart; item <= siblingsEnd; item += 1) items.push(item);
  items.push(siblingsEnd < total - boundary - 1 ? "ellipsis-end" : total - boundary);
  items.push(total);
  return items;
}
