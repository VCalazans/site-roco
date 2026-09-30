"use client";

import { useEffect, useState } from "react";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import ImageIcon from "@mui/icons-material/Image";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/core/trpc-client";
import type { Locale } from "@/i18n/config";
import type { PortalHomeContentDictionary } from "@/modules/portal/lib/home-content-dictionary";
import { interpolate } from "@/shared/lib/interpolate";
import { markOverLimit, moveItem } from "./home-editor-model";
import { ItemActions } from "./item-actions";

const SEARCH_DEBOUNCE_MS = 300;
/** Mínimo de caracteres para buscar: SKUs são numéricos e curtos, nomes têm ≥ 2 letras. */
const MIN_SEARCH_CHARS = 2;
const SEARCH_RESULTS = 10;

type ProductNames = { namePt: string; nameEn: string | null };

function productName(product: ProductNames, locale: Locale): string {
  return locale === "en" ? product.nameEn || product.namePt : product.namePt;
}

type FeaturedProductsManagerProps = {
  locale: Locale;
  dictionary: PortalHomeContentDictionary["featured"]["products"];
  /** Limite da home que o operador está configurando (o valor do formulário, mesmo não salvo). */
  limit: number;
  /** `products:read` — ver a vitrine. */
  canRead: boolean;
  /** `products:update` — mexer nela. */
  canManage: boolean;
  onNotify: (severity: "success" | "error", message: string) => void;
};

/**
 * Gestão dos produtos da vitrine "Produtos em destaque" (RF05): lista na ordem
 * de exibição, reordenar, remover e adicionar por busca.
 *
 * DIFERENTE do resto do editor, aqui cada ação é gravada NA HORA — a vitrine é
 * um atributo do produto (`featured`/`featuredOrder`), não parte do documento
 * da seção, então não há rascunho nem "Salvar seção" para ela. A tela avisa
 * isso (`dictionary.immediate`) para o operador não achar que ficou pendente.
 */
export function FeaturedProductsManager({
  locale,
  dictionary,
  limit,
  canRead,
  canManage,
  onNotify,
}: FeaturedProductsManagerProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const listKey = trpc.products.featuredList.queryKey();

  const listQuery = useQuery(trpc.products.featuredList.queryOptions(undefined, { enabled: canRead }));

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const canSearch = canManage && search.length >= MIN_SEARCH_CHARS;
  const searchQuery = useQuery(
    trpc.products.list.queryOptions({ search, perPage: SEARCH_RESULTS }, { enabled: canSearch })
  );
  const options = canSearch ? (searchQuery.data?.items ?? []) : [];

  function invalidateProducts() {
    queryClient.invalidateQueries({ queryKey: trpc.products.featuredList.queryKey() });
    queryClient.invalidateQueries({ queryKey: trpc.products.list.queryKey() });
    queryClient.invalidateQueries({ queryKey: trpc.products.stats.queryKey() });
  }

  // Otimista: a seta responde na hora, e o servidor confirma em seguida. Em caso
  // de erro volta para a ordem anterior. Os botões ficam desabilitados enquanto
  // a mutação está em voo — duas trocas simultâneas poderiam chegar fora de ordem.
  const reorderMutation = useMutation(
    trpc.products.reorderFeatured.mutationOptions({
      onMutate: async ({ orderedIds }) => {
        await queryClient.cancelQueries({ queryKey: listKey });
        const previous = queryClient.getQueryData(listKey);
        queryClient.setQueryData(listKey, (current) => {
          if (!current) return current;
          const byId = new Map(current.map((item) => [item.id, item]));
          return orderedIds.flatMap((id) => {
            const item = byId.get(id);
            return item ? [item] : [];
          });
        });
        return { previous };
      },
      onError: (_error, _variables, context) => {
        if (context?.previous) queryClient.setQueryData(listKey, context.previous);
        onNotify("error", dictionary.actionFailed);
      },
      onSuccess: () => onNotify("success", dictionary.reordered),
      onSettled: invalidateProducts,
    })
  );

  const flagsMutation = useMutation(
    trpc.products.setFlags.mutationOptions({
      onSuccess: (_product, variables) => {
        invalidateProducts();
        onNotify("success", variables.featured ? dictionary.added : dictionary.removed);
      },
      onError: () => onNotify("error", dictionary.actionFailed),
    })
  );

  if (!canRead) {
    return <Alert severity="info">{dictionary.noRead}</Alert>;
  }

  const items = listQuery.data ?? [];
  const overLimit = markOverLimit(items, limit);
  const busy = reorderMutation.isPending || flagsMutation.isPending;

  function moveProduct(index: number, delta: -1 | 1) {
    reorderMutation.mutate({ orderedIds: moveItem(items, index, index + delta).map((item) => item.id) });
  }

  return (
    <Stack spacing={2}>
      <Alert severity="info" variant="outlined">
        <Stack spacing={0.5}>
          <span>{dictionary.immediate}</span>
          <span>{dictionary.fallback}</span>
        </Stack>
      </Alert>

      {canManage ? (
        <Autocomplete
          options={options}
          value={null}
          inputValue={searchInput}
          onInputChange={(_event, next, reason) => setSearchInput(reason === "reset" ? "" : next)}
          onChange={(_event, option) => {
            if (option) flagsMutation.mutate({ id: option.id, featured: true });
          }}
          filterOptions={(all) => all}
          getOptionLabel={(option) => `${option.sku} — ${productName(option, locale)}`}
          getOptionDisabled={(option) => option.featured}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          loading={canSearch && searchQuery.isFetching}
          loadingText={dictionary.loading}
          noOptionsText={
            canSearch ? dictionary.noOptions : interpolate(dictionary.typeMore, { count: MIN_SEARCH_CHARS })
          }
          disabled={busy}
          blurOnSelect
          renderOption={(props, option) => {
            const { key, ...optionProps } = props;
            return (
              <Box component="li" key={key} {...optionProps} sx={{ gap: 1.5 }}>
                <Avatar
                  variant="rounded"
                  src={option.coverUrl ?? undefined}
                  alt=""
                  sx={{ width: 36, height: 36, bgcolor: "action.hover", color: "text.secondary" }}
                >
                  <ImageIcon fontSize="small" />
                </Avatar>
                <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                  <Typography variant="body2" noWrap>
                    {productName(option, locale)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {interpolate(dictionary.sku, { sku: option.sku })}
                  </Typography>
                </Box>
                {option.featured ? (
                  <Chip size="small" label={dictionary.inShowcase} />
                ) : !option.published ? (
                  <Chip size="small" color="warning" variant="outlined" label={dictionary.notPublished} />
                ) : null}
              </Box>
            );
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label={dictionary.addLabel}
              placeholder={dictionary.addPlaceholder}
              slotProps={{
                ...params.slotProps,
                inputLabel: { ...params.slotProps.inputLabel, shrink: true },
              }}
            />
          )}
        />
      ) : (
        <Alert severity="info">{dictionary.noPermission}</Alert>
      )}

      {listQuery.isLoading ? (
        <Stack spacing={1}>
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} variant="rounded" height={64} />
          ))}
        </Stack>
      ) : listQuery.isError ? (
        <Alert severity="error">{dictionary.loadFailed}</Alert>
      ) : items.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: "center", borderStyle: "dashed" }}>
          <StarBorderIcon color="disabled" />
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {dictionary.empty}
          </Typography>
        </Paper>
      ) : (
        <Stack component="ol" spacing={1} sx={{ listStyle: "none", m: 0, p: 0 }}>
          {items.map((item, index) => {
            const name = productName(item, locale);
            return (
              <Paper
                key={item.id}
                component="li"
                variant="outlined"
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  p: 1.25,
                  opacity: overLimit[index] ? 0.75 : 1,
                }}
              >
                <Typography variant="body2" color="text.secondary" sx={{ width: 24, textAlign: "right", flexShrink: 0 }}>
                  {index + 1}
                </Typography>
                <Avatar
                  variant="rounded"
                  src={item.coverUrl ?? undefined}
                  alt=""
                  sx={{ width: 48, height: 48, bgcolor: "action.hover", color: "text.secondary" }}
                >
                  <ImageIcon fontSize="small" />
                </Avatar>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" noWrap>
                    {name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    {interpolate(dictionary.sku, { sku: item.sku })}
                  </Typography>
                  <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: "wrap" }} useFlexGap>
                    {!item.published ? (
                      <Chip size="small" color="warning" variant="outlined" label={dictionary.notPublished} />
                    ) : null}
                    {item.bestSeller ? (
                      <Chip
                        size="small"
                        color="secondary"
                        variant="outlined"
                        icon={<EmojiEventsIcon />}
                        label={dictionary.bestSeller}
                      />
                    ) : null}
                    {overLimit[index] ? (
                      <Chip size="small" variant="outlined" label={dictionary.overLimit} />
                    ) : null}
                  </Stack>
                  {overLimit[index] ? (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                      {interpolate(dictionary.overLimitHelp, { limit })}
                    </Typography>
                  ) : null}
                </Box>
                {canManage ? (
                  <ItemActions
                    index={index}
                    count={items.length}
                    disabled={busy}
                    onMove={(delta) => moveProduct(index, delta)}
                    onRemove={() => flagsMutation.mutate({ id: item.id, featured: false })}
                    moveUpLabel={interpolate(dictionary.moveUpAria, { name })}
                    moveDownLabel={interpolate(dictionary.moveDownAria, { name })}
                    removeLabel={interpolate(dictionary.removeAria, { name })}
                  />
                ) : null}
              </Paper>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
