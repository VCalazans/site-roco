import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PortalShell } from "@/modules/portal/components/portal-shell";
import { RolesPageClient } from "@/modules/portal/components/roles/roles-page-client";
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
    title: `${portal.roles.title} — ${portal.shell.appName}`,
    robots: { index: false, follow: false },
  };
}

/**
 * Rota `/{locale}/portal/perfis` — perfis/permissões dinâmicos (perfis
 * customizados, matriz `role_permissions`, atribuição a usuários). Gate
 * único por `roles:manage` para a tela inteira (perfis, matriz e usuários
 * são abas da mesma tela). Ver decisionLog 2026-08-24 ("Perfis e
 * permissões dinâmicos").
 */
export default async function PortalRolesPage({ params }: PageProps) {
  const { locale } = await params;
  if (!locales.includes(locale)) {
    notFound();
  }
  const basePath = `/${locale}/portal`;
  const session = await requirePortalSession(locale, `${basePath}/perfis`);

  if (!can(session.user, "roles", "manage")) {
    redirect(basePath);
  }

  const dictionary = await getDictionary(locale);
  const portal = getPortalDictionary(dictionary);

  return (
    <PortalShell {...buildPortalShellProps({ locale, dictionary, session })}>
      <RolesPageClient portal={portal} />
    </PortalShell>
  );
}
