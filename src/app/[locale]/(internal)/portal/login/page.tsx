import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isGoogleSignInEnabled } from "@/core/auth/google";
import {
  EMAIL_NOT_VERIFIED_CODE,
  LOGIN_RATE_LIMITED_CODE,
  LOGIN_UNAVAILABLE_CODE,
} from "@/core/auth/sign-in-errors";
import { AuthPageLayout } from "@/modules/portal/components/account/auth-card";
import { LoginCard } from "@/modules/portal/components/login-card";
import {
  ACCOUNT_PAGE_SEGMENTS,
  accountPagePath,
  LOGIN_NOTICE_PASSWORD_RESET,
} from "@/modules/portal/lib/account-links";
import { loginWithCredentials, loginWithGoogle } from "@/modules/portal/lib/login-action";
import { getPortalDictionary } from "@/modules/portal/lib/types";
import { locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

type PageProps = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ callbackUrl?: string; error?: string; notice?: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

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
    title: `${portal.login.title} — ${portal.shell.appName}`,
    robots: { index: false, follow: false },
  };
}

export default async function PortalLoginPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;

  if (!locales.includes(locale)) {
    notFound();
  }

  const { callbackUrl, error, notice } = await searchParams;
  const dictionary = await getDictionary(locale);
  const portal = getPortalDictionary(dictionary);
  const { login } = portal;

  // Server Actions com argumentos fixados via `.bind` — ver comentário em
  // `login-action.ts` sobre a assinatura (o `FormData` do form chega como
  // último parâmetro na chamada real).
  const safeCallback = callbackUrl ?? `/${locale}/portal`;
  const credentialsAction = loginWithCredentials.bind(
    null,
    `/${locale}/portal/login`,
    safeCallback
  );
  const emailNotVerified = error === EMAIL_NOT_VERIFIED_CODE;
  // `?error=` → mensagem da tela; código desconhecido não mostra nada.
  const errorMessages: Record<string, string> = {
    credentials: login.invalidCredentials,
    [EMAIL_NOT_VERIFIED_CODE]: login.emailNotVerified,
    [LOGIN_RATE_LIMITED_CODE]: login.rateLimited,
    [LOGIN_UNAVAILABLE_CODE]: login.unavailable,
  };

  return (
    <AuthPageLayout>
      <LoginCard
        logoAlt={dictionary.navigation.brand}
        title={login.title}
        subtitle={login.subtitle}
        disclaimer={login.disclaimer}
        emailLabel={login.emailLabel}
        passwordLabel={login.passwordLabel}
        signInButtonLabel={login.signInButton}
        errorMessage={error && Object.hasOwn(errorMessages, error) ? errorMessages[error] : undefined}
        errorAction={
          emailNotVerified
            ? { href: accountPagePath(locale, ACCOUNT_PAGE_SEGMENTS.confirmEmail), label: login.resendConfirmation }
            : undefined
        }
        noticeMessage={notice === LOGIN_NOTICE_PASSWORD_RESET ? login.notices.passwordReset : undefined}
        forgotPassword={{
          href: accountPagePath(locale, ACCOUNT_PAGE_SEGMENTS.forgotPassword),
          label: login.forgotPassword,
        }}
        registerPrompt={login.registerPrompt}
        registerLinkLabel={login.registerLink}
        registerHref={`/${locale}/representantes`}
        credentialsAction={credentialsAction}
        google={
          isGoogleSignInEnabled()
            ? {
                buttonLabel: login.googleButton,
                orDividerLabel: login.orDivider,
                action: loginWithGoogle.bind(null, safeCallback),
              }
            : undefined
        }
      />
    </AuthPageLayout>
  );
}
