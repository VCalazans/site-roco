"use client";

import { useMemo, type ReactNode } from "react";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { createPortalTheme } from "@/core/theme";
import type { Locale } from "@/i18n/config";

type PortalProvidersProps = {
  /** Locale da rota atual — resolve o pacote de tradução interno do MUI
   *  (`TablePagination`, etc.) via `createPortalTheme`. Ver comentário em
   *  `src/core/theme/index.ts` ("Locale dos textos internos do MUI"). */
  locale: Locale;
  children: ReactNode;
};

/**
 * Providers do Portal Interno — isolados do site público, que não usa MUI.
 *
 * SEM `enableCssLayer` — deliberado. Com a layer ligada, o CSS do MUI ia
 * para `@layer mui`, cuja POSIÇÃO na ordem de cascata dependia da ordem de
 * carregamento dos <style>/<link> no head: o <style> do Emotion vinha antes
 * do CSS compilado do Tailwind, `mui` virava a PRIMEIRA layer declarada e
 * perdia para todas as outras — o preflight do Tailwind v4 (`@layer base`,
 * que zera padding/borda de `input`) sobrescrevia as métricas do MUI e os
 * campos do portal encolhiam com o label do outlined fora do lugar (bug real
 * observado; o Tailwind ainda consome qualquer statement `@layer` manual no
 * `globals.css`, então não dá para fixar a ordem por lá). Sem layer, o CSS
 * do MUI é UNLAYERED e vence qualquer layer por regra de cascata. A
 * convivência segue segura: site e portal nunca compartilham componentes
 * (route groups `(site)`/`(internal)`), então não há conflito a arbitrar.
 *
 * `defaultMode="system"` + `CssBaseline enableColorScheme` fazem o portal
 * respeitar o tema do SO no primeiro acesso; o toggle (`theme-toggle.tsx`)
 * grava a preferência explícita em localStorage a partir daí.
 */
export function PortalProviders({ locale, children }: PortalProvidersProps) {
  const theme = useMemo(() => createPortalTheme(locale), [locale]);

  return (
    <AppRouterCacheProvider options={{ key: "mui" }}>
      <ThemeProvider theme={theme} defaultMode="system">
        <CssBaseline enableColorScheme />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
