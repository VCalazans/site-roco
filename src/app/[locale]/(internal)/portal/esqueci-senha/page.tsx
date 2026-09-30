import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthPageLayout } from "@/modules/portal/components/account/auth-card";
import { ForgotPasswordCard } from "@/modules/portal/components/account/forgot-password-card";
import { portalLoginPath } from "@/modules/portal/lib/account-links";
import { getPortalDictionary } from "@/modules/portal/lib/types";
import { locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

type PageProps = { params: Promise<{ locale: Locale }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!locales.includes(locale)) notFound();
  const portal = getPortalDictionary(await getDictionary(locale));
  return {
    title: `${portal.account.forgotPassword.title} — ${portal.shell.appName}`,
    robots: { index: false, follow: false },
  };
}

/** "Esqueci minha senha" — pública (ver `PORTAL_PUBLIC_SEGMENTS` no middleware). */
export default async function ForgotPasswordPage({ params }: PageProps) {
  const { locale } = await params;
  if (!locales.includes(locale)) notFound();
  const dictionary = await getDictionary(locale);
  const portal = getPortalDictionary(dictionary);

  return (
    <AuthPageLayout>
      <ForgotPasswordCard
        logoAlt={dictionary.navigation.brand}
        locale={locale}
        account={portal.account}
        loginHref={portalLoginPath(locale)}
      />
    </AuthPageLayout>
  );
}
