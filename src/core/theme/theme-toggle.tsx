"use client";

import { useSyncExternalStore, type MouseEvent } from "react";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import SettingsBrightnessIcon from "@mui/icons-material/SettingsBrightness";
import Tooltip from "@mui/material/Tooltip";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { useColorScheme } from "@mui/material/styles";

export type ThemeToggleLabels = {
  light: string;
  dark: string;
  system: string;
};

type Mode = "light" | "dark" | "system";

/**
 * `true` só depois de hidratar no client. `useSyncExternalStore` é o jeito
 * recomendado pelo React (em vez de `useState(false)` + `useEffect`) de obter
 * um valor que diverge entre o snapshot do servidor e o do client sem
 * disparar um `setState` dentro de efeito (o lint do projeto,
 * `react-hooks/set-state-in-effect`, trata esse padrão como erro) — a
 * "assinatura" não muda de fonte externa nenhuma, então `subscribe` é um
 * no-op.
 */
function subscribe() {
  return () => {};
}

function useMounted() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}

type ThemeToggleProps = {
  /** Rótulos por estado — usados como `aria-label` de cada botão e como
   *  tooltip. Vêm do dicionário (`portal.shell.themeToggle.*`); nunca
   *  hardcode aqui. */
  labels: ThemeToggleLabels;
};

/**
 * Toggle de 3 estados (claro/sistema/escuro) do tema do portal.
 *
 * `useColorScheme()` só resolve o `mode` real no client, depois que o
 * `<InitColorSchemeScript>` (montado em `(internal)/layout.tsx`) e o React
 * hidratam — no primeiro render de servidor `mode` não existe ainda. Sem a
 * guarda `mounted`, o `value` do `ToggleButtonGroup` divergiria entre o HTML
 * do servidor (sempre "não selecionado") e o client (já com o modo
 * resolvido), gerando um warning de hidratação.
 */
export function ThemeToggle({ labels }: ThemeToggleProps) {
  const { mode, setMode } = useColorScheme();
  const mounted = useMounted();

  const handleChange = (_event: MouseEvent<HTMLElement>, next: Mode | null) => {
    if (next) {
      setMode(next);
    }
  };

  const value = mounted ? (mode ?? "system") : undefined;

  return (
    <ToggleButtonGroup value={value} exclusive onChange={handleChange} size="small">
      <ToggleButton value="light" aria-label={labels.light}>
        <Tooltip title={labels.light}>
          <LightModeIcon fontSize="small" />
        </Tooltip>
      </ToggleButton>
      <ToggleButton value="system" aria-label={labels.system}>
        <Tooltip title={labels.system}>
          <SettingsBrightnessIcon fontSize="small" />
        </Tooltip>
      </ToggleButton>
      <ToggleButton value="dark" aria-label={labels.dark}>
        <Tooltip title={labels.dark}>
          <DarkModeIcon fontSize="small" />
        </Tooltip>
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
