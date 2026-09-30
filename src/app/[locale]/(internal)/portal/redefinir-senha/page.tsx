import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthPageLayout } from "@/modules/portal/components/account/auth-card";
import { ResetPasswordCard } from "@/modules/portal/components/account/reset-password-card";
import {
  ACCOUNT_PAGE_SEGMENTS,
  accountPagePath,
  LOGIN_NOTICE_PASSWORD_RESET,
  portalLoginPath,
} from "@/modules/portal/lib/account-links";
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
    title: `${portal.account.resetPassword.title} — ${portal.shell.appName}`,
    robots: { index: false, follow: false },
  };
}

/**
 * Destino do link de redefinição de senha (`#token=…`, lido no navegador).
 * Pública — ver `PORTAL_PUBLIC_SEGMENTS` no middleware.
 */
export default async function ResetPasswordPage({ params }: PageProps) {
  const { locale } = await params;
  if (!locales.includes(locale)) notFound();
  const dictionary = await getDictionary(locale);
  const portal = getPortalDictionary(dictionary);

  return (
    <AuthPageLayout>
      <ResetPasswordCard
        logoAlt={dictionary.navigation.brand}
        locale={locale}
        account={portal.account}
        loginHref={portalLoginPath(locale)}
        loginAfterResetHref={portalLoginPath(locale, LOGIN_NOTICE_PASSWORD_RESET)}
        forgotPasswordHref={accountPagePath(locale, ACCOUNT_PAGE_SEGMENTS.forgotPassword)}
      />
    </AuthPageLayout>
  );
}
