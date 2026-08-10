import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import { PortalProviders } from "@/core/theme/portal-providers";
import { TRPCReactProvider } from "@/core/trpc-client";
import { locales, type Locale } from "@/i18n/config";

type InternalLayoutProps = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

/**
 * Layout raiz do Portal Interno (`(internal)` route group — não aparece na
 * URL, só isola a subárvore `/portal/*` e `/admin/*` do visual Tailwind do
 * site público). Ainda aninhado sob `src/app/[locale]/layout.tsx`, que só
 * valida o locale: os providers de marketing (`ContactFormProvider`,
 * `WhatsAppFloat`, `MauticTracking`) vivem no route group irmão `(site)` e
 * NÃO renderizam aqui — o portal fica livre de tracking e de widgets do
 * site institucional por construção.
 *
 * `<InitColorSchemeScript attribute="class" />` precisa rodar ANTES de
 * qualquer nó estilizado pelo MUI hidratar, para não haver flash de tema
 * (FOUC): por isso é o primeiro filho retornado aqui, antes de
 * `<PortalProviders>`. `attribute="class"` casa com `colorSchemeSelector:
 * "class"` no tema (`src/core/theme/index.ts`).
 *
 * `<TRPCReactProvider>` (onda 2, `src/core/trpc-client/provider.tsx`) monta
 * o client tRPC + `QueryClientProvider` para toda a subárvore do portal.
 * Independente de `<PortalProviders>` (um resolve dados, o outro tema) —
 * nenhuma ordem de aninhamento específica é exigida entre os dois.
 */
export default async function InternalLayout({
  children,
  params,
}: InternalLayoutProps) {
  const { locale } = await params;

  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  return (
    <>
      <InitColorSchemeScript attribute="class" />
      <TRPCReactProvider>
        <PortalProviders locale={locale as Locale}>{children}</PortalProviders>
      </TRPCReactProvider>
    </>
  );
}
