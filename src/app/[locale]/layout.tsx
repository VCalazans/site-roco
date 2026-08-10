import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { locales, type Locale } from "@/i18n/config";

type LocaleLayoutProps = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

/**
 * Valida o locale para TODA rota localizada e nada mais. Os providers de cada
 * mundo vivem nos route groups: `(site)` (marketing — WhatsApp, Mautic) e
 * `(internal)` (portal — MUI). Não adicione client components aqui.
 */
export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;

  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  return children;
}
