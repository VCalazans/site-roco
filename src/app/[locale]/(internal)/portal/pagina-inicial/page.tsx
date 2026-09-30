import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { HomeContentPageClient } from "@/modules/portal/components/home-content/home-content-page-client";
import { pickEditorDefaults } from "@/modules/portal/components/home-content/home-editor-model";
import { PortalShell } from "@/modules/portal/components/portal-shell";
import { getPortalHomeContentDictionary } from "@/modules/portal/lib/home-content-dictionary";
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
    title: `${getPortalHomeContentDictionary(dictionary).title} — ${portal.shell.appName}`,
    robots: { index: false, follow: false },
  };
}

/**
 * Rota `/{locale}/portal/pagina-inicial` — editor do conteúdo da home (spec
 * 001, RF18–RF21): textos PT/EN, imagens, links, ordem e visibilidade das
 * seções e a vitrine de produtos em destaque. O hero continua em `/portal/hero`.
 *
 * Gate de LEITURA: `home_content:read` (gerente comercial / marketing). Quem só
 * lê vê o editor desabilitado; a escrita é barrada de novo no servidor
 * (`home_content:update`, e `products:update` para a vitrine).
 */
export default async function PortalHomeContentPage({ params }: PageProps) {
  const { locale } = await params;
  if (!locales.includes(locale)) {
    notFound();
  }
  const basePath = `/${locale}/portal`;
  const session = await requirePortalSession(locale, `${basePath}/pagina-inicial`);

  if (!can(session.user, "home_content", "read")) {
    redirect(basePath);
  }

  // O editor mostra o texto padrão dos DOIS idiomas do site (placeholder de cada
  // campo PT/EN), independentemente do idioma do painel — daí as duas leituras.
  const [pt, en] = await Promise.all([getDictionary("pt"), getDictionary("en")]);
  const dictionary = locale === "en" ? en : pt;

  return (
    <PortalShell {...buildPortalShellProps({ locale, dictionary, session })}>
      <HomeContentPageClient
        locale={locale}
        dictionary={getPortalHomeContentDictionary(dictionary)}
        defaults={pickEditorDefaults({ pt: pt.home, en: en.home })}
        canEdit={can(session.user, "home_content", "update")}
        canReadProducts={can(session.user, "products", "read")}
        canEditProducts={can(session.user, "products", "update")}
        canOpenHero={can(session.user, "hero_slides", "read")}
      />
    </PortalShell>
  );
}
