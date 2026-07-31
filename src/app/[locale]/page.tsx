import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComingSoonHero } from "@/modules/landing/components/coming-soon-hero";
import { resolveDestination } from "@/core/config/site";
import { locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { visibleNavLinks } from "@/shared/lib/nav";

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
  const { comingSoon, navigation } = dictionary;

  // Destinations come from env/config; dictionary hrefs are copy-only fallbacks.
  const navLinks = visibleNavLinks(navigation.links).map((link) => ({
    ...link,
    href: resolveDestination(link.href, locale),
  }));

  const content = {
    ...comingSoon,
    primaryCta: {
      ...comingSoon.primaryCta,
      href: resolveDestination(comingSoon.primaryCta.href, locale),
    },
    secondaryCta: {
      ...comingSoon.secondaryCta,
      href: resolveDestination(comingSoon.secondaryCta.href, locale),
    },
  };

  return (
    <ComingSoonHero
      content={content}
      navLinks={navLinks}
      menuLabels={{ open: navigation.menu, close: navigation.close }}
    />
  );
}
