import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PortalShell } from "@/modules/portal/components/portal-shell";
import { SettingsPageClient } from "@/modules/portal/components/settings/settings-page-client";
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
    title: `${portal.settings.title} — ${portal.shell.appName}`,
    robots: { index: false, follow: false },
  };
}

export default async function PortalSettingsPage({ params }: PageProps) {
  const { locale } = await params;
  if (!locales.includes(locale)) {
    notFound();
  }
  const basePath = `/${locale}/portal`;
  const session = await requirePortalSession(locale, `${basePath}/configuracoes`);

  // Só admins acessam esta página (mesma lógica de buildPortalNavItems).
  const isAdmin = session.user.roles?.includes("admin") ?? false;
  if (!isAdmin) {
    redirect(basePath);
  }

  const dictionary = await getDictionary(locale);
  const portal = getPortalDictionary(dictionary);

  return (
    <PortalShell {...buildPortalShellProps({ locale, dictionary, session })}>
      <SettingsPageClient labels={portal.settings} />
    </PortalShell>
  );
}
