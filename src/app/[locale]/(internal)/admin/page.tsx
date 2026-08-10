import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { getPortalDictionary } from "@/modules/portal/lib/types";
import { locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

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
    title: portal.admin.title,
    robots: { index: false, follow: false },
  };
}

/**
 * Placeholder mínimo — o admin (CRUD de produtos, sync ERP, RBAC) é escopo de
 * onda futura (ver memory-bank/decisionLog.md, 2026-08-09).
 */
export default async function AdminPage({ params }: PageProps) {
  const { locale } = await params;

  if (!locales.includes(locale)) {
    notFound();
  }

  const dictionary = await getDictionary(locale);
  const portal = getPortalDictionary(dictionary);

  return (
    <Box
      component="main"
      sx={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
      }}
    >
      <Container maxWidth="sm" sx={{ textAlign: "center", py: 8 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          {portal.admin.title}
        </Typography>
        <Typography color="text.secondary">
          {portal.admin.underConstruction}
        </Typography>
      </Container>
    </Box>
  );
}
