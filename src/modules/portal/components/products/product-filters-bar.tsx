"use client";

import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import FilterAltOffIcon from "@mui/icons-material/FilterAltOff";
import HideImageIcon from "@mui/icons-material/HideImage";
import SearchIcon from "@mui/icons-material/Search";
import StarIcon from "@mui/icons-material/Star";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import InputAdornment from "@mui/material/InputAdornment";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import {
  PRODUCT_QUICK_FILTERS,
  hasActiveProductFilters,
  type ProductFilters,
  type ProductQuickFilter,
  type ProductStatusFilter,
} from "@/modules/portal/lib/product-filters";
import type { ProductCategoryOption } from "@/modules/portal/lib/product-types";
import type { PortalDictionary } from "@/modules/portal/lib/types";

const QUICK_FILTER_ICON: Record<ProductQuickFilter, typeof StarIcon> = {
  featured: StarIcon,
  bestSeller: EmojiEventsIcon,
  noImage: HideImageIcon,
};

type ProductFiltersBarProps = {
  dictionary: PortalDictionary["products"];
  /** `portal.common.search` — rótulo do campo de busca. */
  searchLabel: string;
  categories: ProductCategoryOption[];
  filters: ProductFilters;
  /** Texto digitado (ainda não aplicado à URL: a busca tem debounce). */
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onCategoryChange: (categoryId: string) => void;
  onStatusChange: (status: ProductStatusFilter) => void;
  onToggleQuick: (filter: ProductQuickFilter) => void;
  onClear: () => void;
};

/**
 * Barra de filtros da listagem: busca, categoria, status e filtros rápidos
 * (Destaques / Campeões / Sem foto) como chips-toggle. Tudo controlado pelo
 * dono do estado (`products-page-client.tsx`), que espelha os filtros na URL.
 *
 * `size="small"` nos três campos é deliberado — filtros de listagem acima de
 * uma tabela, todos pequenos entre si (ver "Regra de densidade de campos" em
 * `src/core/theme/index.ts`). O `fullWidth={false}` dos selects impede o
 * default global (`MuiFormControl`) de esticá-los para dividir a barra
 * igualmente com a busca.
 */
export function ProductFiltersBar({
  dictionary,
  searchLabel,
  categories,
  filters,
  searchInput,
  onSearchInputChange,
  onCategoryChange,
  onStatusChange,
  onToggleQuick,
  onClear,
}: ProductFiltersBarProps) {
  const active = hasActiveProductFilters(filters) || searchInput.trim() !== "";

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Stack spacing={2}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            type="search"
            label={searchLabel}
            placeholder={dictionary.searchPlaceholder}
            value={searchInput}
            onChange={(event) => onSearchInputChange(event.target.value)}
            size="small"
            slotProps={{
              htmlInput: { maxLength: 200, autoComplete: "off" },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <FormControl size="small" fullWidth={false} sx={{ minWidth: { sm: 220 } }}>
            <InputLabel id="products-category-filter" shrink>
              {dictionary.table.category}
            </InputLabel>
            <Select
              labelId="products-category-filter"
              label={dictionary.table.category}
              value={filters.categoryId}
              displayEmpty
              notched
              onChange={(event: SelectChangeEvent) => onCategoryChange(event.target.value)}
            >
              <MenuItem value="">{dictionary.filters.categoryAll}</MenuItem>
              {categories.map((category) => (
                <MenuItem key={category.id} value={category.id}>
                  {category.namePt}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth={false} sx={{ minWidth: { sm: 180 } }}>
            <InputLabel id="products-status-filter" shrink>
              {dictionary.table.status}
            </InputLabel>
            <Select
              labelId="products-status-filter"
              label={dictionary.table.status}
              value={filters.status}
              displayEmpty
              notched
              onChange={(event: SelectChangeEvent) =>
                onStatusChange(event.target.value as ProductStatusFilter)
              }
            >
              <MenuItem value="all">{dictionary.filters.statusAll}</MenuItem>
              <MenuItem value="published">{dictionary.status.published}</MenuItem>
              <MenuItem value="unpublished">{dictionary.status.unpublished}</MenuItem>
            </Select>
          </FormControl>
        </Stack>

        <Box
          role="group"
          aria-label={dictionary.filters.quickLabel}
          sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}
        >
          {PRODUCT_QUICK_FILTERS.map((filter) => {
            const Icon = QUICK_FILTER_ICON[filter];
            const selected = filters.quick.includes(filter);
            return (
              <Chip
                key={filter}
                icon={<Icon fontSize="small" />}
                label={dictionary.filters[filter]}
                clickable
                aria-pressed={selected}
                color={selected ? "primary" : "default"}
                variant={selected ? "filled" : "outlined"}
                onClick={() => onToggleQuick(filter)}
              />
            );
          })}
          {active ? (
            <Button
              size="small"
              startIcon={<FilterAltOffIcon fontSize="small" />}
              onClick={onClear}
              sx={{ ml: { sm: "auto" } }}
            >
              {dictionary.filters.clear}
            </Button>
          ) : null}
        </Box>
      </Stack>
    </Paper>
  );
}
