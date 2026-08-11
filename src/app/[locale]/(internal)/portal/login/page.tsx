import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import { LoginCard } from "@/modules/portal/components/login-card";
import { loginWithCredentials, loginWithGoogle } from "@/modules/portal/lib/login-action";
import { getPortalDictionary } from "@/modules/portal/lib/types";
import { locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

type PageProps = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
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
    title: portal.login.title,
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

  const { callbackUrl, error } = await searchParams;
  const dictionary = await getDictionary(locale);
  const portal = getPortalDictionary(dictionary);

  // Server Actions com argumentos fixados via `.bind` — ver comentário em
  // `login-action.ts` sobre a assinatura (o `FormData` do form chega como
  // último parâmetro na chamada real).
  const safeCallback = callbackUrl ?? `/${locale}/portal`;
  const googleAction = loginWithGoogle.bind(null, safeCallback);
  const credentialsAction = loginWithCredentials.bind(
    null,
    `/${locale}/portal/login`,
    safeCallback
  );

  return (
    <Box
      component="main"
      sx={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        px: 2,
      }}
    >
      <Container maxWidth="xs">
        <LoginCard
          logoAlt={dictionary.navigation.brand}
          title={portal.login.title}
          subtitle={portal.login.subtitle}
          googleButtonLabel={portal.login.googleButton}
          disclaimer={portal.login.disclaimer}
          emailLabel={portal.login.emailLabel}
          passwordLabel={portal.login.passwordLabel}
          signInButtonLabel={portal.login.signInButton}
          orDividerLabel={portal.login.orDivider}
          errorMessage={error === "credentials" ? portal.login.invalidCredentials : undefined}
          registerPrompt={portal.login.registerPrompt}
          registerLinkLabel={portal.login.registerLink}
          registerHref={`/${locale}/representantes`}
          googleAction={googleAction}
          credentialsAction={credentialsAction}
        />
      </Container>
    </Box>
  );
}
