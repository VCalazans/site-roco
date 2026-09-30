import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { LeadsPageClient } from "@/modules/portal/components/leads/leads-page-client";
import { pickReplyTemplate } from "@/modules/portal/components/leads/leads-helpers";
import { PortalShell } from "@/modules/portal/components/portal-shell";
import { getPortalLeadsDictionary } from "@/modules/portal/lib/leads-dictionary";
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
    title: `${getPortalLeadsDictionary(dictionary).title} — ${portal.shell.appName}`,
    robots: { index: false, follow: false },
  };
}

/**
 * Rota `/{locale}/portal/solicitacoes` — caixa de entrada dos leads do site
 * (spec 001, RF29). Contém dado pessoal (nome, e-mail, telefone, empresa), por
 * isso o gate é `leads:read` e cada detalhe aberto gera registro de auditoria
 * no servidor. Quem não tem a permissão volta ao painel.
 */
export default async function PortalLeadsPage({ params }: PageProps) {
  const { locale } = await params;
  if (!locales.includes(locale)) {
    notFound();
  }
  const basePath = `/${locale}/portal`;
  const session = await requirePortalSession(locale, `${basePath}/solicitacoes`);

  if (!can(session.user, "leads", "read")) {
    redirect(basePath);
  }

  // Os dois idiomas: a resposta ao visitante (assunto e saudação do e-mail/WhatsApp)
  // sai no idioma em que ele usou o site, independentemente do idioma do painel.
  const [pt, en] = await Promise.all([getDictionary("pt"), getDictionary("en")]);
  const dictionary = locale === "en" ? en : pt;

  return (
    <PortalShell {...buildPortalShellProps({ locale, dictionary, session })}>
      <LeadsPageClient
        locale={locale}
        dictionary={getPortalLeadsDictionary(dictionary)}
        replyTemplates={{
          pt: pickReplyTemplate(getPortalLeadsDictionary(pt)),
          en: pickReplyTemplate(getPortalLeadsDictionary(en)),
        }}
      />
    </PortalShell>
  );
}
