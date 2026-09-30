import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import Skeleton from "@mui/material/Skeleton";
import { ProductsPageClient } from "@/modules/portal/components/products/products-page-client";
import { PortalShell } from "@/modules/portal/components/portal-shell";
import { can } from "@/modules/portal/lib/permissions";
import { requirePortalSession } from "@/modules/portal/lib/require-portal-session";
import { buildPortalShellProps } from "@/modules/portal/lib/shell-props";
import { getPortalDictionary } from "@/modules/portal/lib/types";
import { locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

type PageProps = {
  params: Promise<{ locale: Locale }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;

  if (!locales.includes(locale)) {
    notFound();
  }

  const dictionary = await getDictionary(locale);
  const portal = getPortalDictionary(dictionary);

  return {
    title: `${portal.products.title} — ${portal.shell.appName}`,
    robots: { index: false, follow: false },
  };
}

/**
 * Rota `/{locale}/portal/produtos` — gerenciador de catálogo (CRUD +
 * publicação + sync ERP). Gate de leitura: exige `products:read` (admin
 * sempre passa via `can()`); sem a permissão, redireciona para o dashboard
 * com a mensagem `portal.errors.forbidden` (não há um layout de "acesso
 * negado" dedicado nesta onda — ver relatório final).
 *
 * Os filtros vivem na URL (`?search=&category=&status=&filter=&new=1`): a busca
 * da sidebar, os indicadores do painel e os links compartilhados abrem a lista
 * já filtrada. O `Suspense` é exigido por `useSearchParams` no client.
 */
export default async function PortalProductsPage({ params }: PageProps) {
  const { locale } = await params;

  if (!locales.includes(locale)) {
    notFound();
  }

  const basePath = `/${locale}/portal`;
  const session = await requirePortalSession(locale, `${basePath}/produtos`);

  if (!can(session.user, "products", "read")) {
    redirect(basePath);
  }

  const dictionary = await getDictionary(locale);
  const portal = getPortalDictionary(dictionary);

  return (
    <PortalShell {...buildPortalShellProps({ locale, dictionary, session })}>
      <Suspense fallback={<Skeleton variant="rounded" height={320} />}>
        <ProductsPageClient portal={portal} user={session.user} locale={locale} />
      </Suspense>
    </PortalShell>
  );
}
