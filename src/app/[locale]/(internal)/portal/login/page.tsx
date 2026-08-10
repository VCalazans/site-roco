import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import { LoginCard } from "@/modules/portal/components/login-card";
import { loginWithGoogle } from "@/modules/portal/lib/login-action";
import { getPortalDictionary } from "@/modules/portal/lib/types";
import { locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

type PageProps = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ callbackUrl?: string }>;
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

  const { callbackUrl } = await searchParams;
  const dictionary = await getDictionary(locale);
  const portal = getPortalDictionary(dictionary);

  // Server Action com o primeiro argumento fixado — ver comentário em
  // `login-action.ts` sobre por que a assinatura recebe `FormData` como
  // segundo (e último, na chamada real) parâmetro.
  const action = loginWithGoogle.bind(null, callbackUrl ?? `/${locale}/portal`);

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
          action={action}
        />
      </Container>
    </Box>
  );
}
