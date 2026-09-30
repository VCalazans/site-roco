import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { OnboardingWizard } from "@/modules/portal/components/onboarding/onboarding-wizard";
import { PortalShell } from "@/modules/portal/components/portal-shell";
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

  return (
    <PortalShell {...buildPortalShellProps({ locale, dictionary, session })}>
      <Box sx={{ maxWidth: 900, mx: "auto" }}>
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
