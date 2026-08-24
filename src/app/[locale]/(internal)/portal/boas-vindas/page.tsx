import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ComputerIcon from "@mui/icons-material/Computer";
import DownloadIcon from "@mui/icons-material/Download";
import FactoryIcon from "@mui/icons-material/Factory";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import Box from "@mui/material/Box";
import {
  PortalShell,
  type PortalNavItem,
} from "@/modules/portal/components/portal-shell";
import { WelcomeClosing } from "@/modules/portal/components/welcome/welcome-closing";
import { WelcomeDwSystemCard } from "@/modules/portal/components/welcome/welcome-dw-system-card";
import { WelcomeHero } from "@/modules/portal/components/welcome/welcome-hero";
import { WelcomeMaterialsFeed } from "@/modules/portal/components/welcome/welcome-materials-feed";
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
 * hero de boas-vindas + cards institucionais (Conheça a ROCO, Catálogo) +
 * card do Sistema DW + feed de materiais publicados (linha do tempo,
 * `WelcomeMaterialsFeed`) + encerramento. Visível a qualquer sessão válida
 * (não tem gate de permissão própria — o item de nav já limita quem
 * normalmente chega aqui a `representative`/`admin`, ver `nav-items.ts`);
 * `/portal` (dashboard) redireciona para cá quem é representante "puro"
 * (ver `permissions.ts#isRepresentativeOnly`).
 *
 * Os cards de Contatos/Política Comercial/Logística/Biblioteca de vídeos
 * (sempre "Em breve", sem asset real) saíram daqui — viraram itens
 * publicáveis no feed de materiais. Ver decisionLog 2026-08-24 ("Materiais
 * dinâmicos para representantes").
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

  const navItems: PortalNavItem[] = buildPortalNavItems(
    basePath,
    { ...portal.shell.nav, materials: portal.materials.title, roles: portal.roles.title },
    session.user
  );
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
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
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
        </Box>

        <Box sx={{ mt: 3 }}>
          <WelcomeDwSystemCard content={welcome.dwSystem} icon={<ComputerIcon fontSize="large" />} />
        </Box>

        <Box sx={{ mt: 3 }}>
          <WelcomeMaterialsFeed locale={locale} dictionary={welcome.materialsFeed} />
        </Box>

        <WelcomeClosing content={welcome.closing} />
      </Box>
    </PortalShell>
  );
}
