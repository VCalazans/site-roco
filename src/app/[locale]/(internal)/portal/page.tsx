import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { contactPath } from "@/core/config/site";
import { DashboardSummary } from "@/modules/portal/components/dashboard-summary";
import { PendingAccessPanel } from "@/modules/portal/components/pending-access-panel";
import { PortalShell } from "@/modules/portal/components/portal-shell";
import { formatSubmittedDate } from "@/modules/portal/lib/pending-access";
import { isAwaitingAccess, isRepresentativeOnly } from "@/modules/portal/lib/permissions";
import { requirePortalSession } from "@/modules/portal/lib/require-portal-session";
import { buildPortalShellProps } from "@/modules/portal/lib/shell-props";
import { getPortalDictionary } from "@/modules/portal/lib/types";
import { locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getPendingAccessRecord } from "@/server/lib/pending-access";
import { interpolate } from "@/shared/lib/interpolate";

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
 * Dashboard do portal: saudação + indicadores clicáveis, atalhos, solicitações
 * recentes e saúde do catálogo (`DashboardSummary`, client — cada bloco só
 * aparece, e só consulta o servidor, se a sessão tem a permissão
 * correspondente).
 *
 * Quem é representante "puro" (role `representative`, sem nenhuma role de
 * time interno — ver `isRepresentativeOnly`) não vê este dashboard:
 * `/portal/boas-vindas` é a home dele (hero + materiais de apoio + status do
 * onboarding), o dashboard de métricas não faz sentido para esse público.
 *
 * Quem entrou SEM perfil nenhum (pré-cadastro esperando a aprovação) também não
 * vê o dashboard — sem permissão, ele sairia vazio: `PendingAccessPanel` mostra
 * a situação do cadastro e o que esperar.
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

  // Primeiro nome: "Olá, Victor!" soa mais natural que o nome completo do
  // Google/cadastro. Sem nome cai no e-mail (contas só com credenciais).
  const displayName =
    session.user.name?.trim().split(/\s+/)[0] || session.user.email || "";
  const greeting = interpolate(portal.dashboard.welcome, { name: displayName });

  // Sem perfil (pré-cadastro aguardando aprovação): o painel sairia vazio —
  // no lugar dele, a situação do cadastro e o que esperar.
  if (isAwaitingAccess(session.user)) {
    const record = await getPendingAccessRecord(session.user.id);
    return (
      <PortalShell {...buildPortalShellProps({ locale, dictionary, session })}>
        <PendingAccessPanel
          greeting={greeting}
          status={record.status}
          submittedAt={record.submittedAt ? formatSubmittedDate(record.submittedAt, locale) : null}
          companyName={record.companyName}
          reviewNotes={record.reviewNotes}
          copy={portal.pendingAccess}
          links={{ onboarding: `${basePath}/onboarding`, contact: contactPath(locale), site: `/${locale}` }}
        />
      </PortalShell>
    );
  }

  return (
    <PortalShell {...buildPortalShellProps({ locale, dictionary, session })}>
      <Box>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            {greeting}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {portal.dashboard.subtitle}
          </Typography>
        </Box>
        <DashboardSummary portal={portal} user={session.user} locale={locale} />
      </Box>
    </PortalShell>
  );
}
