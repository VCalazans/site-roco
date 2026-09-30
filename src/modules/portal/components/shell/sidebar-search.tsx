"use client";

import { useState, useSyncExternalStore, type FormEvent, type Ref } from "react";
import { useRouter } from "next/navigation";
import SearchIcon from "@mui/icons-material/Search";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";

export type SidebarSearchLabels = {
  label: string;
  placeholder: string;
  /** Dica de atalho fora do macOS ("Ctrl K") e no macOS ("⌘K"). */
  shortcut: string;
  shortcutMac: string;
};

type SidebarSearchProps = {
  /** Destino da busca (`/{locale}/portal/produtos`); o termo vai em `?search=`. */
  href: string;
  labels: SidebarSearchLabels;
  collapsed?: boolean;
  /** Recolhido: o clique no ícone pede para expandir a sidebar e focar o campo. */
  onExpandRequest?: () => void;
  /** Depois de navegar — fecha o drawer no mobile. */
  onSubmitted?: () => void;
  inputRef?: Ref<HTMLInputElement>;
};

function subscribeNever() {
  return () => {};
}

/**
 * `true` em macOS/iOS só depois de hidratar. `useSyncExternalStore` com
 * snapshot de servidor `false` evita divergência de hidratação (o servidor
 * não conhece o navegador) sem o `useEffect` + `setState` que o lint proíbe.
 */
function useIsApplePlatform(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => /Mac|iPhone|iPad|iPod/i.test(window.navigator.userAgent),
    () => false
  );
}

/** Teto do servidor para `products.list` (`search.max(200)`). */
const MAX_SEARCH_LENGTH = 200;

/**
 * Busca de produtos da sidebar (spec 001, RF26). Funciona como lançador: Enter
 * leva para `/portal/produtos?search=<termo>` (a página lê o termo da URL) e o
 * campo é limpo — o termo passa a viver no campo da própria listagem, então a
 * sidebar não fica com um valor antigo em cima dos filtros novos. Enter com o
 * campo vazio abre a listagem sem filtro.
 *
 * Ctrl/⌘ + K é tratado no shell (precisa saber se a sidebar está recolhida ou
 * se é mobile); este componente só expõe o `inputRef` para o foco.
 */
export function SidebarSearch({
  href,
  labels,
  collapsed = false,
  onExpandRequest,
  onSubmitted,
  inputRef,
}: SidebarSearchProps) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const isApple = useIsApplePlatform();

  if (collapsed) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", pb: 1 }}>
        <Tooltip title={labels.label} placement="right">
          <IconButton
            aria-label={labels.label}
            onClick={onExpandRequest}
            sx={{ width: 44, height: 44, borderRadius: 1.5 }}
          >
            <SearchIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = value.trim().slice(0, MAX_SEARCH_LENGTH);
    router.push(term ? `${href}?search=${encodeURIComponent(term)}` : href);
    setValue("");
    onSubmitted?.();
  }

  return (
    <Box
      component="form"
      role="search"
      onSubmit={handleSubmit}
      noValidate
      sx={{
        px: 1.5,
        pb: 1,
        // A dica de atalho some enquanto se digita e em telas de toque (sem
        // teclado físico ela é só ruído).
        "&:focus-within .sidebar-search-hint": { display: "none" },
        "@media (hover: none)": { "& .sidebar-search-hint": { display: "none" } },
      }}
    >
      {/* `size="small"` deliberado: campo utilitário de uma sidebar densa, nunca
          o único campo de uma tela — ver "Regra de densidade de campos" em
          `src/core/theme/index.ts`. */}
      <TextField
        size="small"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={labels.placeholder}
        inputRef={inputRef}
        slotProps={{
          htmlInput: {
            "aria-label": labels.label,
            maxLength: MAX_SEARCH_LENGTH,
            enterKeyHint: "search",
            autoComplete: "off",
          },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end" className="sidebar-search-hint">
                <Box
                  component="kbd"
                  sx={{
                    fontFamily: "inherit",
                    fontSize: 11,
                    lineHeight: 1,
                    px: 0.75,
                    py: 0.5,
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 1,
                    color: "text.secondary",
                    whiteSpace: "nowrap",
                  }}
                >
                  {isApple ? labels.shortcutMac : labels.shortcut}
                </Box>
              </InputAdornment>
            ),
          },
        }}
      />
    </Box>
  );
}
