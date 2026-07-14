import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComingSoonHero } from "@/modules/landing/components/coming-soon-hero";
import { siteLinks } from "@/core/config/site";
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
    title: dictionary.seo.title,
    description: dictionary.seo.description,
  };
}

export default async function LandingPage({ params }: PageProps) {
  const { locale } = await params;

  if (!locales.includes(locale)) {
    notFound();
  }

  const dictionary = await getDictionary(locale);

  // CTA destinations come from env/config; dictionary hrefs are copy-only fallbacks.
  const { comingSoon } = dictionary;
  const content = {
    ...comingSoon,
    primaryCta: {
      ...comingSoon.primaryCta,
      href: siteLinks.products || comingSoon.primaryCta.href,
    },
    secondaryCta: {
      ...comingSoon.secondaryCta,
      href: siteLinks.catalog || comingSoon.secondaryCta.href,
    },
  };

  return (
    <ComingSoonHero content={content} navLinks={dictionary.navigation.links} />
  );
}
