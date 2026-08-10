"use client";

import type { ReactNode } from "react";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { theme } from "@/core/theme";

type PortalProvidersProps = {
  children: ReactNode;
};

/**
 * Providers do Portal Interno — isolados do site público, que não usa MUI.
 *
 * `enableCssLayer: true` faz o Emotion emitir o CSS do MUI dentro de
 * `@layer mui`. O Tailwind (via `@import "tailwindcss"` em `globals.css`)
 * gera suas utilities fora de qualquer `@layer` nomeada — que sempre vence
 * uma layer nomeada por regra de cascata do CSS — então a convivência é
 * previsível nos dois sentidos: nada do MUI vaza para a landing/catálogo
 * (módulos diferentes, nunca importam isto) e nada do Tailwind é sobrescrito
 * por engano pelo MUI dentro do portal.
 *
 * `defaultMode="system"` + `CssBaseline enableColorScheme` fazem o portal
 * respeitar o tema do SO no primeiro acesso; o toggle (`theme-toggle.tsx`)
 * grava a preferência explícita em localStorage a partir daí.
 */
export function PortalProviders({ children }: PortalProvidersProps) {
  return (
    <AppRouterCacheProvider options={{ key: "mui", enableCssLayer: true }}>
      <ThemeProvider theme={theme} defaultMode="system">
        <CssBaseline enableColorScheme />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
