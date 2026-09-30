"use client";

import { useMemo, useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTerritoryIndex } from "@/modules/portal/lib/territory-client";
import type { PortalTerritoryDictionary } from "@/modules/portal/lib/types";
import { interpolate } from "@/shared/lib/interpolate";
import {
  MAX_TERRITORY_ENTRIES,
  searchTerritories,
  sortTerritory,
  territoryKey,
  type TerritoryOption,
} from "@/shared/lib/territory";

type TerritoryPickerProps = {
  value: TerritoryOption[];
  onChange: (value: TerritoryOption[]) => void;
  copy: PortalTerritoryDictionary;
  error?: string;
  disabled?: boolean;
  size?: "small" | "medium";
};

/** Texto do chip: a região leva o tipo junto ("Campinas — SP" é região E cidade). */
export function territoryChipLabel(option: TerritoryOption, copy: PortalTerritoryDictionary): string {
  return option.kind === "region" ? `${option.label} · ${copy.kinds.region}` : option.label;
}

/**
 * Campo da área de atuação: uma busca só por estado, região (mesorregião do
 * IBGE) ou cidade, com quantas escolhas forem precisas (até
 * `MAX_TERRITORY_ENTRIES`). A base do IBGE desce sob demanda
 * (`useTerritoryIndex`); os valores já escolhidos chegam prontos do servidor,
 * então os chips aparecem antes mesmo de a base carregar.
 */
export function TerritoryPicker({ value, onChange, copy, error, disabled, size }: TerritoryPickerProps) {
  const { index, failed } = useTerritoryIndex();
  const [input, setInput] = useState("");
  const full = value.length >= MAX_TERRITORY_ENTRIES;

  const options = useMemo(() => {
    if (!index || full) return [];
    const chosen = new Set(value.map(territoryKey));
    return searchTerritories(index, input).filter((option) => !chosen.has(territoryKey(option)));
  }, [index, input, value, full]);

  const noOptionsText = full
    ? interpolate(copy.limit, { max: String(MAX_TERRITORY_ENTRIES) })
    : failed
      ? copy.loadError
      : copy.noOptions;

  return (
    <Autocomplete
      multiple
      value={value}
      onChange={(_event, next) => onChange(sortTerritory(next))}
      inputValue={input}
      onInputChange={(_event, next, reason) => {
        // Escolher uma opção "reseta" o texto do MUI: aqui o campo fica limpo para a próxima busca.
        setInput(reason === "reset" ? "" : next);
      }}
      options={options}
      filterOptions={(list) => list}
      getOptionLabel={(option) => option.label}
      getOptionKey={(option) => territoryKey(option)}
      isOptionEqualToValue={(option, selected) => territoryKey(option) === territoryKey(selected)}
      loading={!index && !failed}
      loadingText={copy.loading}
      noOptionsText={noOptionsText}
      disabled={disabled}
      disableCloseOnSelect
      size={size}
      renderOption={(props, option) => {
        const { key, ...optionProps } = props;
        return (
          <li key={key} {...optionProps}>
            <Stack direction="row" sx={{ width: "100%", justifyContent: "space-between", gap: 2 }}>
              <span>{option.label}</span>
              <Typography component="span" variant="caption" color="text.secondary">
                {copy.kinds[option.kind]}
              </Typography>
            </Stack>
          </li>
        );
      }}
      renderValue={(selected, getItemProps) =>
        selected.map((option, itemIndex) => {
          const { key, ...itemProps } = getItemProps({ index: itemIndex });
          return (
            <Chip
              key={key}
              label={territoryChipLabel(option, copy)}
              size={size === "small" ? "small" : "medium"}
              {...itemProps}
            />
          );
        })
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label={copy.label}
          placeholder={value.length === 0 ? copy.placeholder : undefined}
          error={Boolean(error)}
          helperText={error ?? copy.helper}
        />
      )}
    />
  );
}
