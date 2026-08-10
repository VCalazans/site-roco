import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { RepresentativesPageClient } from "@/modules/portal/components/representatives/representatives-page-client";
import {
  PortalShell,
  type PortalNavItem,
} from "@/modules/portal/components/portal-shell";
import { buildPortalNavItems } from "@/modules/portal/lib/nav-items";
import { logoutAction } from "@/modules/portal/lib/logout-action";
import { can } from "@/modules/portal/lib/permissions";
import { requirePortalSession } from "@/modules/portal/lib/require-portal-session";
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
  const { navigation } = dictionary;

  const navItems: PortalNavItem[] = buildPortalNavItems(
    basePath,
    portal.shell.nav,
    session.user
  );

  return (
    <PortalShell
      appName={portal.shell.appName}
      logoAlt={navigation.brand}
      navItems={navItems}
      comingSoonLabel={portal.shell.comingSoon}
      menuLabels={{ open: navigation.menu, close: navigation.close }}
      themeToggleLabels={portal.shell.themeToggle}
      userMenu={{
        profileLabel: portal.shell.userMenu.profile,
        logoutLabel: portal.shell.userMenu.logout,
      }}
      user={session.user}
      logoutAction={logoutAction}
    >
      <RepresentativesPageClient portal={portal} user={session.user} />
    </PortalShell>
  );
}
