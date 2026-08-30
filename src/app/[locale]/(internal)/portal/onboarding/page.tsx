import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { OnboardingWizard } from "@/modules/portal/components/onboarding/onboarding-wizard";
import {
  PortalShell,
  type PortalNavItem,
} from "@/modules/portal/components/portal-shell";
import { buildPortalNavItems } from "@/modules/portal/lib/nav-items";
import { logoutAction } from "@/modules/portal/lib/logout-action";
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
    title: `${portal.onboarding.title} — ${portal.shell.appName}`,
    robots: { index: false, follow: false },
  };
}

/**
 * Rota `/{locale}/portal/onboarding` — wizard de cadastro de representantes.
 * Server Component: resolve locale, sessão (`requirePortalSession`) e
 * dicionário; toda a interatividade (Stepper, mutations tRPC) vive em
 * `OnboardingWizard` ("use client").
 */
export default async function PortalOnboardingPage({ params }: PageProps) {
  const { locale } = await params;

  if (!locales.includes(locale)) {
    notFound();
  }

  const session = await requirePortalSession(locale, `/${locale}/portal/onboarding`);
  const dictionary = await getDictionary(locale);
  const portal = getPortalDictionary(dictionary);
  const { navigation } = dictionary;

  const basePath = `/${locale}/portal`;
  const navItems: PortalNavItem[] = buildPortalNavItems(
    basePath,
    { ...portal.shell.nav, materials: portal.materials.title, roles: portal.roles.title, settings: portal.settings.title },
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
      <Box sx={{ maxWidth: 900 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {portal.onboarding.title}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          {portal.onboarding.subtitle}
        </Typography>

        <OnboardingWizard
          portal={portal}
          sessionUser={{ name: session.user.name, email: session.user.email }}
        />
      </Box>
    </PortalShell>
  );
}
