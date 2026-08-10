"use client";

import { useEffect, useMemo, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/core/trpc-client";
import { can, type PortalPermissionUser } from "@/modules/portal/lib/permissions";
import type { ProductListItem } from "@/modules/portal/lib/product-types";
import type { PortalDictionary } from "@/modules/portal/lib/types";
import { DeleteProductDialog } from "./delete-product-dialog";
import { ProductFormDialog } from "./product-form-dialog";
import { ProductTable } from "./product-table";
import { SyncBar } from "./sync-bar";

type PublishedFilter = "all" | "published" | "unpublished";

type ProductsPageClientProps = {
  portal: PortalDictionary;
  user: PortalPermissionUser;
};

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;

/**
 * Orquestrador client-side da página de produtos: busca (debounced), filtro
 * por categoria e por status de publicação, tabela paginada por cursor
 * (`useInfiniteQuery` + botão "carregar mais" — escolhido em vez de
 * `TablePagination` porque cursor não expõe contagem total nem "página N"),
 * barra de sync do ERP e dialogs de criar/editar/excluir.
 */
export function ProductsPageClient({ portal, user }: ProductsPageClientProps) {
  const dictionary = portal.products;
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [publishedFilter, setPublishedFilter] = useState<PublishedFilter>("all");

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const published =
    publishedFilter === "all" ? undefined : publishedFilter === "published";

  const categoriesQuery = useQuery(trpc.products.categories.list.queryOptions());

  const listQuery = useInfiniteQuery(
    trpc.products.list.infiniteQueryOptions(
      {
        search: search || undefined,
        categoryId: categoryId || undefined,
        published,
        limit: PAGE_SIZE,
      },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      }
    )
  );

  const items: ProductListItem[] = useMemo(
    () => listQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [listQuery.data]
  );

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Incrementado a cada abertura do dialog e usado como `key` — força o
  // `ProductFormDialog` a REMONTAR (em vez de reagir a `open`/`productId`
  // via `useEffect`, proibido por `react-hooks/set-state-in-effect` para
  // `setState` síncrono) a cada nova abertura, resetando seu estado interno
  // de graça, sem efeito nenhum do lado de lá.
  const [formInstance, setFormInstance] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<ProductListItem | null>(null);

  function invalidateList() {
    queryClient.invalidateQueries({ queryKey: trpc.products.list.queryKey() });
  }

  const setPublishedMutation = useMutation(
    trpc.products.setPublished.mutationOptions({
      onSuccess: invalidateList,
    })
  );

  const deleteMutation = useMutation(
    trpc.products.delete.mutationOptions({
      onSuccess: () => {
        invalidateList();
        setDeleteTarget(null);
      },
    })
  );

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

  function openCreateDialog() {
    setEditingId(null);
    setFormInstance((instance) => instance + 1);
    setFormOpen(true);
  }

  function openEditDialog(id: string) {
    setEditingId(id);
    setFormInstance((instance) => instance + 1);
    setFormOpen(true);
  }

  function closeFormDialog() {
    setFormOpen(false);
    invalidateList();
  }

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
          <Typography variant="h4" component="h1" gutterBottom>
            {dictionary.title}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {dictionary.subtitle}
          </Typography>
        </Box>
        {canCreate ? (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
            {dictionary.form.createTitle}
          </Button>
        ) : null}
      </Stack>

      {canSyncRead ? <SyncBar dictionary={dictionary.sync} canTrigger={canSyncTrigger} /> : null}

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            label={portal.common.search}
            placeholder={dictionary.searchPlaceholder}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            fullWidth
            size="small"
          />
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="products-category-filter">{dictionary.table.category}</InputLabel>
            <Select
              labelId="products-category-filter"
              label={dictionary.table.category}
              value={categoryId}
              onChange={(event: SelectChangeEvent) => setCategoryId(event.target.value)}
            >
              <MenuItem value="">{portal.common.clear}</MenuItem>
              {(categoriesQuery.data ?? []).map((category) => (
                <MenuItem key={category.id} value={category.id}>
                  {category.namePt}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="products-published-filter">{dictionary.table.status}</InputLabel>
            <Select
              labelId="products-published-filter"
              label={dictionary.table.status}
              value={publishedFilter}
              onChange={(event: SelectChangeEvent) =>
                setPublishedFilter(event.target.value as PublishedFilter)
              }
            >
              <MenuItem value="all">{portal.common.filter}</MenuItem>
              <MenuItem value="published">{dictionary.status.published}</MenuItem>
              <MenuItem value="unpublished">{dictionary.status.unpublished}</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {listQuery.isError ? <Alert severity="error">{portal.errors.generic}</Alert> : null}

      {!listQuery.isLoading && items.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 6, textAlign: "center" }}>
          <Typography variant="h6">{dictionary.empty.title}</Typography>
          <Typography color="text.secondary">{dictionary.empty.description}</Typography>
        </Paper>
      ) : (
        <Paper variant="outlined">
          <ProductTable
            dictionary={dictionary}
            items={items}
            isLoading={listQuery.isLoading}
            canWrite={canWrite}
            canPublish={canPublish}
            canDelete={canDelete}
            onEdit={openEditDialog}
            onTogglePublished={(product) =>
              setPublishedMutation.mutate({ id: product.id, published: !product.published })
            }
            onDelete={setDeleteTarget}
          />
          {listQuery.hasNextPage ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
              <Button
                onClick={() => listQuery.fetchNextPage()}
                disabled={listQuery.isFetchingNextPage}
                startIcon={
                  listQuery.isFetchingNextPage ? <CircularProgress size={16} /> : null
                }
              >
                {portal.common.loading}
              </Button>
            </Box>
          ) : null}
        </Paper>
      )}

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
      />

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
      />
    </Box>
  );
}
