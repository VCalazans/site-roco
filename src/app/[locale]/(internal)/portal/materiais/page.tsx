import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PortalShell } from "@/modules/portal/components/portal-shell";
import { MaterialsLibrary } from "@/modules/portal/components/materials/materials-library";
import { MaterialsPageClient } from "@/modules/portal/components/materials/materials-page-client";
import { can } from "@/modules/portal/lib/permissions";
import { requirePortalSession } from "@/modules/portal/lib/require-portal-session";
import { buildPortalShellProps } from "@/modules/portal/lib/shell-props";
import { getPortalDictionary } from "@/modules/portal/lib/types";
import { locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

type PageProps = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ visao?: string }>;
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
 * Rota `/{locale}/portal/materiais` — uma rota, duas telas (revisão 2026-09-30):
 * - quem GERENCIA materiais (`materials:create`) vê o CRUD administrativo,
 *   com o botão "Ver como representante" (`?visao=representante`);
 * - quem só LÊ (`materials:read` — o representante) vê a biblioteca
 *   organizada por setor (`MaterialsLibrary`). Antes o representante só
 *   encontrava os materiais numa lista corrida no fim de `/portal/boas-vindas`
 *   e não tinha item de menu para eles.
 * Sem nenhuma das duas permissões, volta para o painel. Ver decisionLog
 * 2026-08-24 ("Materiais dinâmicos para representantes").
 */
export default async function PortalMaterialsPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  if (!locales.includes(locale)) {
    notFound();
  }
  const basePath = `/${locale}/portal`;
  const session = await requirePortalSession(locale, `${basePath}/materiais`);

  const canManage = can(session.user, "materials", "create");
  if (!canManage && !can(session.user, "materials", "read")) {
    redirect(basePath);
  }

  const { visao } = await searchParams;
  const preview = canManage && visao === "representante";
  const dictionary = await getDictionary(locale);
  const portal = getPortalDictionary(dictionary);

  return (
    <PortalShell {...buildPortalShellProps({ locale, dictionary, session })}>
      {canManage && !preview ? (
        <MaterialsPageClient
          portal={portal}
          canWrite={can(session.user, "materials", "update")}
          canDelete={can(session.user, "materials", "delete")}
          previewHref={`${basePath}/materiais?visao=representante`}
        />
      ) : (
        <MaterialsLibrary
          locale={locale}
          dictionary={portal.materials}
          preview={preview ? { backHref: `${basePath}/materiais` } : undefined}
        />
      )}
    </PortalShell>
  );
}
