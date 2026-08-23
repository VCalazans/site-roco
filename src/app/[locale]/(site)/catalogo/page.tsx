import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { getCatalogPdfUrl } from "@/server/lib/site-settings";
import { locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

type PageProps = {
  params: Promise<{ locale: Locale }>;
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
  return {
    title: dictionary.catalog.seo.title,
    description: dictionary.catalog.seo.description,
  };
}

export default async function CatalogPage({ params }: PageProps) {
  const { locale } = await params;

  if (!locales.includes(locale)) {
    notFound();
  }

  const dictionary = await getDictionary(locale);
  const { catalog } = dictionary;
  const pdfUrl = await getCatalogPdfUrl();

  return (
    <main className="bg-background">
      <Container maxWidth="md" sx={{ py: { xs: 8, md: 14 } }}>
        <Stack spacing={4} sx={{ alignItems: "center", textAlign: "center" }}>
          <Box
            sx={{
              position: "relative",
              width: { xs: 240, md: 320 },
              height: { xs: 240, md: 320 },
              borderRadius: "50%",
              overflow: "hidden",
              boxShadow: "0 0 60px -10px rgba(53, 217, 255, 0.35)",
            }}
          >
            <Image
              src="/images/hero/hero-stage.jpg"
              alt={catalog.sceneAlt}
              fill
              priority
              sizes="(max-width: 768px) 240px, 320px"
              className="object-cover"
            />
          </Box>

          <Stack spacing={2} sx={{ alignItems: "center" }}>
            <p className="text-glow-amber text-meta font-semibold uppercase tracking-[0.2em] text-neon-amber-bright">
              {dictionary.navigation.brand}
            </p>
            <Typography
              variant="h2"
              component="h1"
              sx={{
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                letterSpacing: "-0.01em",
                textWrap: "balance",
              }}
            >
              {catalog.headline}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 560 }}>
              {catalog.description}
            </Typography>
          </Stack>

          <Button
            component={Link}
            href={pdfUrl}
            download
            variant="contained"
            size="large"
            sx={{
              borderRadius: 999,
              px: 5,
              py: 1.5,
              fontSize: "var(--type-ui)",
              fontWeight: "var(--type-ui-weight)",
              background: "linear-gradient(118deg, #35d9ff 0%, #f5a33c 100%)",
              color: "#05070b",
              "&:hover": { background: "linear-gradient(118deg, #6ce6ff 0%, #ffb454 100%)" },
            }}
          >
            {catalog.submit}
          </Button>
        </Stack>
      </Container>
    </main>
  );
}
