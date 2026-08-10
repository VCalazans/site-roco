import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { DashboardSummary } from "@/modules/portal/components/dashboard-summary";
import {
  PortalShell,
  type PortalNavItem,
} from "@/modules/portal/components/portal-shell";
import { buildPortalNavItems } from "@/modules/portal/lib/nav-items";
import { logoutAction } from "@/modules/portal/lib/logout-action";
import { isRepresentativeOnly } from "@/modules/portal/lib/permissions";
import { requirePortalSession } from "@/modules/portal/lib/require-portal-session";
import { getPortalDictionary } from "@/modules/portal/lib/types";
import { locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

type PageProps = {
  params: Promise<{ locale: Locale }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;

  if (!locales.includes(locale)) {
    notFound();
  }

  const dictionary = await getDictionary(locale);
  const portal = getPortalDictionary(dictionary);

  return {
    title: `${portal.dashboard.title} — ${portal.shell.appName}`,
    robots: { index: false, follow: false },
  };
}

/**
 * Dashboard do portal. Onda 2: nav real (`Onboarding`/`Produtos`/
 * `Representantes` conforme sessão, via `buildPortalNavItems`) + cards de
 * resumo (`DashboardSummary`, client — contagens tRPC condicionadas à mesma
 * permissão das respectivas páginas).
 *
 * Onda 3: quem é representante "puro" (role `representative`, sem nenhuma
 * role de time interno — ver `isRepresentativeOnly`) não vê este dashboard:
 * `/portal/boas-vindas` é a home dele (hero + materiais de apoio + status do
 * onboarding), o dashboard de métricas (produtos/representantes) não faz
 * sentido para esse público.
 */
export default async function PortalDashboardPage({ params }: PageProps) {
  const { locale } = await params;

  if (!locales.includes(locale)) {
    notFound();
  }

  const basePath = `/${locale}/portal`;
  const session = await requirePortalSession(locale, basePath);

  if (isRepresentativeOnly(session.user)) {
    redirect(`${basePath}/boas-vindas`);
  }

  const dictionary = await getDictionary(locale);
  const portal = getPortalDictionary(dictionary);
  const { navigation } = dictionary;

  const navItems: PortalNavItem[] = buildPortalNavItems(
    basePath,
    portal.shell.nav,
    session.user
  );

  const welcomeMessage = portal.dashboard.welcome.replace(
    "{name}",
    session.user.name ?? session.user.email ?? ""
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
      <Box sx={{ maxWidth: 960 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {portal.dashboard.title}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          {welcomeMessage}
        </Typography>
        <DashboardSummary portal={portal} user={session.user} />
      </Box>
    </PortalShell>
  );
}
