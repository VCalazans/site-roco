import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  PortalShell,
  type PortalNavItem,
} from "@/modules/portal/components/portal-shell";
import { MaterialsPageClient } from "@/modules/portal/components/materials/materials-page-client";
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
    title: `${portal.materials.title} — ${portal.shell.appName}`,
    robots: { index: false, follow: false },
  };
}

/**
 * Rota `/{locale}/portal/materiais` — CRUD administrativo de materiais de
 * apoio compartilhados com representantes. Gate por `materials:create`
 * (não `materials:read`): o representante tem `read` só para consultar o
 * feed embutido em `/portal/boas-vindas` (`WelcomeMaterialsFeed`), nunca
 * deveria cair nesta tela de gestão. Ver decisionLog 2026-08-24
 * ("Materiais dinâmicos para representantes").
 */
export default async function PortalMaterialsPage({ params }: PageProps) {
  const { locale } = await params;
  if (!locales.includes(locale)) {
    notFound();
  }
  const basePath = `/${locale}/portal`;
  const session = await requirePortalSession(locale, `${basePath}/materiais`);

  if (!can(session.user, "materials", "create")) {
    redirect(basePath);
  }

  const dictionary = await getDictionary(locale);
  const portal = getPortalDictionary(dictionary);
  const { navigation } = dictionary;

  const navItems: PortalNavItem[] = buildPortalNavItems(
    basePath,
    { ...portal.shell.nav, materials: portal.materials.title, roles: portal.roles.title },
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
      <MaterialsPageClient
        portal={portal}
        canWrite={can(session.user, "materials", "update")}
        canDelete={can(session.user, "materials", "delete")}
      />
    </PortalShell>
  );
}
