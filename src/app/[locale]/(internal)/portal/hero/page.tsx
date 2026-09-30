import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PortalShell } from "@/modules/portal/components/portal-shell";
import { HeroPageClient } from "@/modules/portal/components/hero/hero-page-client";
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
    title: `${portal.hero.title} — ${portal.shell.appName}`,
    robots: { index: false, follow: false },
  };
}

export default async function PortalHeroPage({ params }: PageProps) {
  const { locale } = await params;
  if (!locales.includes(locale)) {
    notFound();
  }
  const basePath = `/${locale}/portal`;
  const session = await requirePortalSession(locale, `${basePath}/hero`);

  if (!can(session.user, "hero_slides", "read")) {
    redirect(basePath);
  }

  const dictionary = await getDictionary(locale);
  const portal = getPortalDictionary(dictionary);

  return (
    <PortalShell {...buildPortalShellProps({ locale, dictionary, session })}>
      <HeroPageClient
        portal={portal}
        canWrite={can(session.user, "hero_slides", "update")}
        canDelete={can(session.user, "hero_slides", "delete")}
      />
    </PortalShell>
  );
}
