import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { RepresentativesPageClient } from "@/modules/portal/components/representatives/representatives-page-client";
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
    title: `${portal.representatives.title} — ${portal.shell.appName}`,
    robots: { index: false, follow: false },
  };
}

/**
 * Rota `/{locale}/portal/representantes` — revisão de onboarding
 * (aprovar/rejeitar). Visível apenas com `representatives:read`; sem a
 * permissão, redireciona para o dashboard (mesmo padrão de `produtos/page.tsx`
 * — não há layout de "acesso negado" dedicado nesta onda).
 */
export default async function PortalRepresentativesPage({ params }: PageProps) {
  const { locale } = await params;

  if (!locales.includes(locale)) {
    notFound();
  }

  const basePath = `/${locale}/portal`;
  const session = await requirePortalSession(locale, `${basePath}/representantes`);

  if (!can(session.user, "representatives", "read")) {
    redirect(basePath);
  }

  const dictionary = await getDictionary(locale);
  const portal = getPortalDictionary(dictionary);

  return (
    <PortalShell {...buildPortalShellProps({ locale, dictionary, session })}>
      <RepresentativesPageClient portal={portal} user={session.user} />
    </PortalShell>
  );
}
