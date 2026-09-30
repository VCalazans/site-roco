"use client";

import Pagination from "@mui/material/Pagination";
import TablePagination from "@mui/material/TablePagination";
import type { TablePaginationActionsProps } from "@mui/material/TablePaginationActions";
import { clampPage, pageCountOf, PORTAL_PER_PAGE_OPTIONS } from "@/modules/portal/lib/pagination";

type PortalPaginationProps = {
  /** Página atual, a partir de 1 (como na URL e nas rotas tRPC). */
  page: number;
  perPage: number;
  /** Total de itens do filtro, não só da página. */
  total: number;
  onPageChange: (page: number) => void;
  /** Sem ele, o seletor de "itens por página" não aparece. */
  onPerPageChange?: (perPage: number) => void;
  perPageOptions?: readonly number[];
};

/**
 * Rodapé de paginação de TODAS as listas do portal (produtos, solicitações,
 * representantes, usuários): "itens por página", faixa "1–20 de 737" e
 * páginas numeradas com primeira/última — trocar para a página 30 não exige
 * 29 cliques. Os textos vêm do idioma do tema do MUI (`ptBR`/`enUS` em
 * `src/core/theme`), então nada de copy aqui.
 *
 * A aplicação conta páginas a partir de 1; só o `TablePagination` conta a
 * partir de 0 — a conversão fica toda neste componente.
 */
export function PortalPagination({
  page,
  perPage,
  total,
  onPageChange,
  onPerPageChange,
  perPageOptions = PORTAL_PER_PAGE_OPTIONS,
}: PortalPaginationProps) {
  const current = clampPage(page, total, perPage);

  return (
    <TablePagination
      component="div"
      count={total}
      page={current - 1}
      rowsPerPage={perPage}
      rowsPerPageOptions={onPerPageChange ? [...perPageOptions] : []}
      onPageChange={(_event, zeroBasedPage) => onPageChange(zeroBasedPage + 1)}
      onRowsPerPageChange={(event) => onPerPageChange?.(Number(event.target.value))}
      ActionsComponent={NumberedPageActions}
      sx={{
        borderTop: "1px solid",
        borderColor: "divider",
        // Em tela estreita a faixa e as páginas quebram de linha em vez de rolar.
        "& .MuiTablePagination-toolbar": { flexWrap: "wrap", rowGap: 1, justifyContent: "flex-end" },
        "& .MuiTablePagination-spacer": { display: { xs: "none", sm: "block" } },
      }}
    />
  );
}

/**
 * Ações do `TablePagination` trocadas por páginas numeradas. No celular só
 * ficam primeira, anterior, atual, próxima e última.
 */
function NumberedPageActions({
  count,
  page,
  rowsPerPage,
  onPageChange,
  className,
  disabled,
}: TablePaginationActionsProps) {
  return (
    <Pagination
      className={className}
      disabled={disabled}
      count={pageCountOf(count, rowsPerPage)}
      page={page + 1}
      onChange={(_event, value) => onPageChange(null, value - 1)}
      showFirstButton
      showLastButton
      siblingCount={1}
      boundaryCount={1}
      size="small"
      shape="rounded"
      color="primary"
      sx={{
        ml: { xs: 0, sm: 2 },
        "& .MuiPaginationItem-page:not(.Mui-selected), & .MuiPaginationItem-ellipsis": {
          display: { xs: "none", sm: "inline-flex" },
        },
      }}
    />
  );
}
