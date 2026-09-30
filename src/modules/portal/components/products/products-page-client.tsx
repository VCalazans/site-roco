"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import AddIcon from "@mui/icons-material/Add";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/core/trpc-client";
import type { Locale } from "@/i18n/config";
import { applyPaging, parsePaging, type Paging } from "@/modules/portal/lib/pagination";
import { can, type PortalPermissionUser } from "@/modules/portal/lib/permissions";
import {
  EMPTY_PRODUCT_FILTERS,
  PRODUCT_NEW_PARAM,
  PRODUCT_SEARCH_MAX_LENGTH,
  applyProductFilters,
  hasActiveProductFilters,
  parseProductFilters,
  toProductListInput,
  toggleQuickFilter,
  type ProductFilters,
  type ProductQuickFilter,
  type ProductStatusFilter,
} from "@/modules/portal/lib/product-filters";
import {
  buildWhatsappShareUrl,
  productPublicUrl,
} from "@/modules/portal/lib/product-links";
import type { ProductListItem } from "@/modules/portal/lib/product-types";
import type { PortalDictionary } from "@/modules/portal/lib/types";
import { interpolate } from "@/shared/lib/interpolate";
import { PortalPagination } from "../shared/portal-pagination";
import { DeleteProductDialog } from "./delete-product-dialog";
import { ProductFiltersBar } from "./product-filters-bar";
import { ProductFormDialog } from "./product-form-dialog";
import { ProductImagesBulkDownloadDialog } from "./product-images-bulk-download-dialog";
import { ProductImagesDialog } from "./product-images-dialog";
import { ProductTable } from "./product-table";
import { SyncBar } from "./sync-bar";

type ProductsPageClientProps = {
  portal: PortalDictionary;
  user: PortalPermissionUser;
  locale: Locale;
};

type Feedback = { message: string; severity: "success" | "error" };

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Grava parâmetros na URL SEM navegar: `history.replaceState` é integrado ao
 * roteador do Next (o `useSearchParams` reflete a mudança) e evita a ida ao
 * servidor que um `router.replace` faria a cada tecla — a página é dinâmica
 * (sessão) e reexecutaria o Server Component só para devolver o mesmo HTML.
 *
 * Parte SEMPRE da URL viva (`window.location`), nunca do `searchParams` do
 * render: a atualização do `useSearchParams` acontece numa transição do Next e
 * pode chegar depois de um segundo clique rápido, que então apagaria o
 * primeiro.
 */
function replaceSearchParams(update: (current: URLSearchParams) => URLSearchParams) {
  const query = update(new URLSearchParams(window.location.search)).toString();
  window.history.replaceState(
    null,
    "",
    query ? `${window.location.pathname}?${query}` : window.location.pathname
  );
}

/** Filtros novos sempre recomeçam na página 1 (`applyProductFilters` tira a página). */
function replaceProductFilters(next: ProductFilters) {
  replaceSearchParams((current) => applyProductFilters(current, next));
}

function replacePaging(next: Paging) {
  replaceSearchParams((current) => applyPaging(current, next));
}

function readLiveFilters(): ProductFilters {
  return parseProductFilters(new URLSearchParams(window.location.search));
}

function readLivePaging(): Paging {
  return parsePaging(new URLSearchParams(window.location.search));
}

/** Copia para a área de transferência; cai no `execCommand` fora de contexto seguro. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const field = document.createElement("textarea");
      field.value = text;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(field);
      return copied;
    } catch {
      return false;
    }
  }
}

/**
 * Orquestrador client-side da página de produtos.
 *
 * Filtros (busca, categoria, status, filtros rápidos) e paginação vivem NA URL
 * e são a fonte de verdade: a busca da sidebar (`router.push('?search=…')`), os
 * indicadores do painel e links compartilhados abrem a lista já filtrada, e o
 * "voltar" do navegador funciona. Só o texto do campo de busca tem estado
 * local (feedback imediato enquanto se digita), gravado na URL com debounce.
 *
 * Tabela com paginação numerada (`PortalPagination`, a mesma das outras listas
 * do portal), barra de sync do ERP e diálogos de criar/editar/excluir. Quem só
 * tem `products:read` (representante) usa o mesmo catálogo sem as ações de
 * escrita, mas com ver no site, copiar link, compartilhar e — com
 * `product_images:download` — baixar as imagens originais, de um produto ou
 * de todos os produtos do filtro.
 */
export function ProductsPageClient({ portal, user, locale }: ProductsPageClientProps) {
  const dictionary = portal.products;
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const tableTopRef = useRef<HTMLDivElement | null>(null);

  // Permissões espelham exatamente `permissionProcedure(resource, action)` de
  // `src/server/trpc/routers/products.ts`/`sync.ts` — cada ação de escrita
  // tem seu próprio par resource:action no contrato (não existe um
  // "products:update" genérico cobrindo publish/create).
  const canCreate = can(user, "products", "create");
  const canWrite = can(user, "products", "update");
  const canPublish = can(user, "products", "publish");
  const canDelete = can(user, "products", "delete");
  const canSyncTrigger = can(user, "sync", "trigger");
  const canSyncRead = can(user, "sync", "read");
  const canDownloadImages = can(user, "product_images", "download");
  const readOnly = !canWrite && !canCreate;

  // --- Filtros e paginação (URL = fonte de verdade) -------------------------
  const filters = useMemo(() => parseProductFilters(searchParams), [searchParams]);
  const paging = useMemo(() => parsePaging(searchParams), [searchParams]);

  const [searchInput, setSearchInput] = useState(filters.search);
  // Último `?search=` da URL já refletido no campo, e último termo que ESTA
  // página gravou. Se a URL muda por fora (sidebar, voltar/avançar, link) o
  // campo adota o valor novo; se a mudança é a eco da nossa própria gravação,
  // o campo já tem o texto (e pode ter avançado alguns caracteres) — não se
  // mexe. "Ajustar estado durante o render", condicional, sem efeito.
  const [syncedSearch, setSyncedSearch] = useState(filters.search);
  const [lastWrittenSearch, setLastWrittenSearch] = useState(filters.search);
  if (filters.search !== syncedSearch) {
    setSyncedSearch(filters.search);
    if (filters.search !== lastWrittenSearch) {
      setSearchInput(filters.search);
      setLastWrittenSearch(filters.search);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const term = searchInput.trim().slice(0, PRODUCT_SEARCH_MAX_LENGTH);
      const live = readLiveFilters();
      if (term === live.search) return;
      setLastWrittenSearch(term);
      replaceProductFilters({ ...live, search: term });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  function setCategory(categoryId: string) {
    replaceProductFilters({ ...readLiveFilters(), categoryId });
  }

  function setStatus(status: ProductStatusFilter) {
    replaceProductFilters({ ...readLiveFilters(), status });
  }

  function toggleQuick(filter: ProductQuickFilter) {
    replaceProductFilters(toggleQuickFilter(readLiveFilters(), filter));
  }

  function clearFilters() {
    setSearchInput("");
    setLastWrittenSearch("");
    replaceProductFilters(EMPTY_PRODUCT_FILTERS);
  }

  /** Troca de página leva ao topo da TABELA (não da página), sem animação para quem pediu menos movimento. */
  function goToPage(page: number) {
    replacePaging({ ...readLivePaging(), page });
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    tableTopRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }

  function setPerPage(perPage: number) {
    replacePaging({ page: 1, perPage });
  }

  // --- Dados ----------------------------------------------------------------
  const categoriesQuery = useQuery(trpc.products.categories.list.queryOptions());

  const listQuery = useQuery(
    trpc.products.list.queryOptions(
      { ...toProductListInput(filters), page: paging.page, perPage: paging.perPage },
      // Mantém a página anterior na tela enquanto a nova carrega: trocar de
      // página ou de filtro não pisca o esqueleto a cada consulta.
      { placeholderData: keepPreviousData }
    )
  );

  const items: ProductListItem[] = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const effectivePage = listQuery.data?.page ?? paging.page;

  // O servidor limita a página ao intervalo real (?page=99 depois de um filtro
  // que sobrou 2 páginas devolve a 2): a URL adota a página efetiva. Só com a
  // resposta DESTA consulta — o placeholder é da consulta anterior.
  const serverPage = listQuery.isPlaceholderData ? undefined : listQuery.data?.page;
  useEffect(() => {
    if (serverPage !== undefined && serverPage !== readLivePaging().page) {
      replacePaging({ ...readLivePaging(), page: serverPage });
    }
  }, [serverPage]);

  /** A tabela, a capa/contagem de fotos e os indicadores do painel mudam junto. */
  function invalidateCatalog() {
    queryClient.invalidateQueries(trpc.products.list.pathFilter());
    queryClient.invalidateQueries(trpc.products.stats.pathFilter());
  }

  // --- Feedback -------------------------------------------------------------
  const [feedback, setFeedback] = useState<Feedback>({ message: "", severity: "success" });
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  function showFeedback(message: string, severity: Feedback["severity"] = "success") {
    setFeedback({ message, severity });
    setFeedbackOpen(true);
  }

  // --- Estado dos diálogos --------------------------------------------------
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Incrementado a cada abertura do dialog e usado como `key` — força o
  // `ProductFormDialog` a REMONTAR (em vez de reagir a `open`/`productId`
  // via `useEffect`, proibido por `react-hooks/set-state-in-effect` para
  // `setState` síncrono) a cada nova abertura, resetando seu estado interno
  // de graça, sem efeito nenhum do lado de lá.
  const [formInstance, setFormInstance] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<ProductListItem | null>(null);
  // Galeria de download: o produto fica guardado até o fim da animação de saída.
  const [imagesTarget, setImagesTarget] = useState<ProductListItem | null>(null);
  const [imagesOpen, setImagesOpen] = useState(false);
  const [bulkDownloadOpen, setBulkDownloadOpen] = useState(false);

  // --- Mutations por linha --------------------------------------------------
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(() => new Set());

  const setPublishedMutation = useMutation(trpc.products.setPublished.mutationOptions());
  const setFlagsMutation = useMutation(trpc.products.setFlags.mutationOptions());
  const deleteMutation = useMutation(
    trpc.products.delete.mutationOptions({
      onSuccess: () => {
        invalidateCatalog();
        setDeleteTarget(null);
        showFeedback(dictionary.feedback.deleted);
      },
      onError: () => showFeedback(dictionary.feedback.actionFailed, "error"),
    })
  );

  /** Marca o produto como ocupado durante a ação; ignora clique enquanto ocupado. */
  async function runForProduct(id: string, action: () => Promise<void>) {
    if (busyIds.has(id)) return;
    setBusyIds((current) => new Set(current).add(id));
    try {
      await action();
      invalidateCatalog();
    } catch {
      showFeedback(dictionary.feedback.actionFailed, "error");
    } finally {
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  }

  function handleTogglePublished(product: ProductListItem) {
    void runForProduct(product.id, async () => {
      await setPublishedMutation.mutateAsync({ id: product.id, published: !product.published });
      showFeedback(
        product.published ? dictionary.feedback.publishedOff : dictionary.feedback.publishedOn
      );
    });
  }

  function handleToggleFeatured(product: ProductListItem) {
    void runForProduct(product.id, async () => {
      await setFlagsMutation.mutateAsync({ id: product.id, featured: !product.featured });
      showFeedback(
        product.featured
          ? dictionary.feedback.featuredRemoved
          : product.published
            ? dictionary.feedback.featuredAdded
            : dictionary.feedback.featuredAddedUnpublished
      );
    });
  }

  function handleToggleBestSeller(product: ProductListItem) {
    void runForProduct(product.id, async () => {
      await setFlagsMutation.mutateAsync({ id: product.id, bestSeller: !product.bestSeller });
      showFeedback(
        product.bestSeller ? dictionary.feedback.bestSellerOff : dictionary.feedback.bestSellerOn
      );
    });
  }

  async function handleCopyLink(product: ProductListItem) {
    const url = productPublicUrl(window.location.origin, locale, product.slug);
    if (await copyText(url)) {
      showFeedback(dictionary.feedback.linkCopied);
    } else {
      showFeedback(dictionary.feedback.copyFailed, "error");
    }
  }

  function handleShareWhatsapp(product: ProductListItem) {
    const url = productPublicUrl(window.location.origin, locale, product.slug);
    const message = interpolate(dictionary.share.message, { name: product.namePt, url });
    window.open(buildWhatsappShareUrl(message), "_blank", "noopener,noreferrer");
  }

  // --- Diálogos (abrir/fechar) ---------------------------------------------
  function openCreateDialog() {
    setEditingId(null);
    setFormInstance((instance) => instance + 1);
    setFormOpen(true);
  }

  function openEditDialog(product: ProductListItem) {
    setEditingId(product.id);
    setFormInstance((instance) => instance + 1);
    setFormOpen(true);
  }

  function closeFormDialog() {
    setFormOpen(false);
    invalidateCatalog();
  }

  function openImagesDialog(product: ProductListItem) {
    setImagesTarget(product);
    setImagesOpen(true);
  }

  // `?new=1` (atalho "Novo produto" do painel) abre o diálogo de criação uma
  // vez e some da URL, para um F5 não reabri-lo. Cobre também o caso de já
  // estar na página quando o parâmetro aparece.
  const wantsNew = searchParams.get(PRODUCT_NEW_PARAM) === "1";
  const [handledNew, setHandledNew] = useState(false);
  if (wantsNew && !handledNew) {
    setHandledNew(true);
    if (canCreate) openCreateDialog();
  } else if (!wantsNew && handledNew) {
    setHandledNew(false);
  }

  useEffect(() => {
    if (!wantsNew) return;
    replaceSearchParams((current) => {
      current.delete(PRODUCT_NEW_PARAM);
      return current;
    });
  }, [wantsNew]);

  // --- Render ---------------------------------------------------------------
  const filtersActive = hasActiveProductFilters(filters);
  const isInitialLoading = listQuery.isLoading;
  const isRefreshing = listQuery.isFetching && !isInitialLoading;
  const countLabel = interpolate(total === 1 ? dictionary.count.one : dictionary.count.other, {
    count: new Intl.NumberFormat(locale).format(total),
  });

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", sm: "center" },
          mb: 3,
        }}
      >
        <Box>
          <Stack
            direction="row"
            spacing={1.5}
            useFlexGap
            sx={{ alignItems: "baseline", flexWrap: "wrap" }}
          >
            <Typography variant="h4" component="h1" gutterBottom>
              {dictionary.title}
            </Typography>
            {!isInitialLoading ? (
              <Chip label={countLabel} size="small" variant="outlined" aria-live="polite" />
            ) : null}
          </Stack>
          <Typography variant="body1" color="text.secondary">
            {readOnly ? dictionary.subtitleReadOnly : dictionary.subtitle}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: "wrap" }}>
          {canDownloadImages ? (
            <Button
              variant={canCreate ? "outlined" : "contained"}
              startIcon={<FileDownloadOutlinedIcon />}
              onClick={() => setBulkDownloadOpen(true)}
            >
              {dictionary.bulkDownload.button}
            </Button>
          ) : null}
          {canCreate ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
              {dictionary.form.createTitle}
            </Button>
          ) : null}
        </Stack>
      </Stack>

      {canSyncRead ? (
        <SyncBar dictionary={dictionary.sync} locale={locale} canTrigger={canSyncTrigger} />
      ) : null}

      <ProductFiltersBar
        dictionary={dictionary}
        searchLabel={portal.common.search}
        categories={categoriesQuery.data ?? []}
        filters={filters}
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        onCategoryChange={setCategory}
        onStatusChange={setStatus}
        onToggleQuick={toggleQuick}
        onClear={clearFilters}
      />

      {listQuery.isError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {portal.errors.generic}
        </Alert>
      ) : null}

      {!isInitialLoading && !listQuery.isError && items.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 6, textAlign: "center" }}>
          <Typography variant="h6">
            {filtersActive ? dictionary.emptyFiltered.title : dictionary.empty.title}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: filtersActive ? 2 : 0 }}>
            {filtersActive ? dictionary.emptyFiltered.description : dictionary.empty.description}
          </Typography>
          {filtersActive ? (
            <Button variant="outlined" onClick={clearFilters}>
              {dictionary.filters.clear}
            </Button>
          ) : null}
        </Paper>
      ) : null}

      {isInitialLoading || items.length > 0 ? (
        <Paper ref={tableTopRef} variant="outlined" sx={{ overflow: "hidden", scrollMarginTop: 88 }}>
          {/* Faixa de altura fixa: o indicador de atualização entra sem empurrar a tabela. */}
          <Box sx={{ height: 3 }}>
            {isRefreshing ? <LinearProgress aria-label={portal.common.loading} /> : null}
          </Box>
          <ProductTable
            dictionary={dictionary}
            locale={locale}
            items={items}
            isLoading={isInitialLoading}
            busyIds={busyIds}
            canWrite={canWrite}
            canPublish={canPublish}
            canDelete={canDelete}
            canOpenImages={canDownloadImages}
            onEdit={openEditDialog}
            onOpenImages={openImagesDialog}
            onTogglePublished={handleTogglePublished}
            onToggleFeatured={handleToggleFeatured}
            onToggleBestSeller={handleToggleBestSeller}
            onCopyLink={handleCopyLink}
            onShareWhatsapp={handleShareWhatsapp}
            onDelete={setDeleteTarget}
          />
          {!isInitialLoading ? (
            <PortalPagination
              page={effectivePage}
              perPage={paging.perPage}
              total={total}
              onPageChange={goToPage}
              onPerPageChange={setPerPage}
            />
          ) : null}
        </Paper>
      ) : null}

      <ProductFormDialog
        key={formInstance}
        open={formOpen}
        onClose={closeFormDialog}
        productId={editingId}
        dictionary={dictionary}
        commonDictionary={portal.common}
        errorLabel={portal.errors.generic}
        categories={categoriesQuery.data ?? []}
        user={user}
        locale={locale}
      />

      <ProductImagesDialog
        product={imagesTarget}
        open={imagesOpen}
        onClose={() => setImagesOpen(false)}
        onExited={() => setImagesTarget(null)}
        dictionary={dictionary}
        errorLabel={portal.errors.generic}
        locale={locale}
      />

      {canDownloadImages ? (
        <ProductImagesBulkDownloadDialog
          open={bulkDownloadOpen}
          onClose={() => setBulkDownloadOpen(false)}
          filters={filters}
          dictionary={dictionary}
          cancelLabel={portal.common.cancel}
          errorLabel={portal.errors.generic}
          locale={locale}
          onStarted={() => showFeedback(dictionary.bulkDownload.started)}
        />
      ) : null}

      <DeleteProductDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate({ id: deleteTarget.id });
          }
        }}
        isDeleting={deleteMutation.isPending}
        dictionary={dictionary.deleteConfirm}
        productName={deleteTarget?.namePt}
      />

      <Snackbar
        open={feedbackOpen}
        autoHideDuration={4000}
        onClose={(_event, reason) => {
          if (reason !== "clickaway") setFeedbackOpen(false);
        }}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Alert
          severity={feedback.severity}
          variant="filled"
          onClose={() => setFeedbackOpen(false)}
          sx={{ width: "100%" }}
        >
          {feedback.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
