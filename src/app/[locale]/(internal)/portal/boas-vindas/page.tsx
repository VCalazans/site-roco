import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ComputerIcon from "@mui/icons-material/Computer";
import ContactsIcon from "@mui/icons-material/Contacts";
import DownloadIcon from "@mui/icons-material/Download";
import FactoryIcon from "@mui/icons-material/Factory";
import GavelIcon from "@mui/icons-material/Gavel";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import OndemandVideoIcon from "@mui/icons-material/OndemandVideo";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import VideoLibraryIcon from "@mui/icons-material/VideoLibrary";
import Box from "@mui/material/Box";
import {
  PortalShell,
  type PortalNavItem,
} from "@/modules/portal/components/portal-shell";
import { WelcomeClosing } from "@/modules/portal/components/welcome/welcome-closing";
import { WelcomeDwSystemCard } from "@/modules/portal/components/welcome/welcome-dw-system-card";
import { WelcomeHero } from "@/modules/portal/components/welcome/welcome-hero";
import { WelcomeSectionCard } from "@/modules/portal/components/welcome/welcome-section-card";
import { OnboardingStatusAlert } from "@/modules/portal/components/welcome/onboarding-status-alert";
import { buildPortalNavItems } from "@/modules/portal/lib/nav-items";
import { logoutAction } from "@/modules/portal/lib/logout-action";
import { REPRESENTATIVE_ROLE_SLUG } from "@/modules/portal/lib/permissions";
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
    title: `${portal.welcome.hero.title} — ${portal.shell.appName}`,
    robots: { index: false, follow: false },
  };
}

/**
 * Rota `/{locale}/portal/boas-vindas` — home do representante comercial:
 * hero de boas-vindas + materiais de apoio (catálogo, contatos, política
 * comercial, logística, Sistema DW, biblioteca de vídeos) + encerramento.
 * Visível a qualquer sessão válida (não tem gate de permissão própria — o
 * item de nav já limita quem normalmente chega aqui a `representative`/
 * `admin`, ver `nav-items.ts`); `/portal` (dashboard) redireciona para cá
 * quem é representante "puro" (ver `permissions.ts#isRepresentativeOnly`).
 *
 * Único CTA com destino real hoje é o catálogo (`public/downloads/`); os
 * demais materiais ainda não têm asset no portal — botão desabilitado com
 * `portal.welcome.comingSoon` como tooltip (nunca inventamos uma URL).
 */
export default async function PortalWelcomePage({ params }: PageProps) {
  const { locale } = await params;

  if (!locales.includes(locale)) {
    notFound();
  }

  const basePath = `/${locale}/portal`;
  const session = await requirePortalSession(locale, `${basePath}/boas-vindas`);
  const dictionary = await getDictionary(locale);
  const portal = getPortalDictionary(dictionary);
  const { navigation } = dictionary;
  const welcome = portal.welcome;

  const navItems: PortalNavItem[] = buildPortalNavItems(basePath, portal.shell.nav, session.user);
  const isRepresentative = session.user.roles?.includes(REPRESENTATIVE_ROLE_SLUG) ?? false;

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
      <Box sx={{ maxWidth: 1200 }}>
        <WelcomeHero content={welcome.hero} logoAlt={navigation.brand} />

        {/* Só o representante tem um cadastro de onboarding para checar —
            admin/sales_manager/viewer que abrem esta página não têm
            `representatives.me()` próprio. */}
        {isRepresentative ? (
          <OnboardingStatusAlert
            onboardingHref={`${basePath}/onboarding`}
            dictionary={portal.onboarding}
          />
        ) : null}

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" },
            gap: 3,
          }}
        >
          <WelcomeSectionCard
            icon={<FactoryIcon fontSize="large" />}
            title={welcome.about.title}
            body={welcome.about.body}
            comingSoonLabel={welcome.comingSoon}
          />
          <WelcomeSectionCard
            icon={<MenuBookIcon fontSize="large" />}
            title={welcome.catalog.title}
            body={welcome.catalog.body}
            ctaLabel={welcome.catalog.cta}
            ctaIcon={<DownloadIcon fontSize="small" />}
            href="/downloads/catalogo-roco-2026.pdf"
            download
            comingSoonLabel={welcome.comingSoon}
          />
          <WelcomeSectionCard
            icon={<ContactsIcon fontSize="large" />}
            title={welcome.contacts.title}
            body={welcome.contacts.body}
            ctaLabel={welcome.contacts.cta}
            ctaIcon={<DownloadIcon fontSize="small" />}
            comingSoonLabel={welcome.comingSoon}
          />
          <WelcomeSectionCard
            icon={<GavelIcon fontSize="large" />}
            title={welcome.commercialPolicy.title}
            body={welcome.commercialPolicy.body}
            ctaLabel={welcome.commercialPolicy.cta}
            ctaIcon={<DownloadIcon fontSize="small" />}
            comingSoonLabel={welcome.comingSoon}
          />
          <WelcomeSectionCard
            icon={<LocalShippingIcon fontSize="large" />}
            title={welcome.logistics.title}
            body={welcome.logistics.body}
            ctaLabel={welcome.logistics.cta}
            ctaIcon={<DownloadIcon fontSize="small" />}
            comingSoonLabel={welcome.comingSoon}
          />
          <WelcomeSectionCard
            icon={<VideoLibraryIcon fontSize="large" />}
            title={welcome.library.title}
            body={welcome.library.body}
            ctaLabel={welcome.library.cta}
            ctaIcon={<OpenInNewIcon fontSize="small" />}
            comingSoonLabel={welcome.comingSoon}
          />
        </Box>

        <Box sx={{ mt: 3 }}>
          <WelcomeDwSystemCard
            content={welcome.dwSystem}
            icon={<ComputerIcon fontSize="large" />}
            ctaIcon={<OndemandVideoIcon fontSize="small" />}
            comingSoonLabel={welcome.comingSoon}
          />
        </Box>

        <WelcomeClosing content={welcome.closing} />
      </Box>
    </PortalShell>
  );
}
