import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HomeHero } from "@/modules/home/components/home-hero";
import { HomeAbout } from "@/modules/home/components/home-about";
import { HomeCategories } from "@/modules/home/components/home-categories";
import { HomeFeatured } from "@/modules/home/components/home-featured";
import { HomePortalCta } from "@/modules/home/components/home-portal-cta";
import { resolveDestination } from "@/core/config/site";
import { locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getFeaturedProducts, getPublicCategoryList, getPublicProductList } from "@/server/lib/public-products";
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

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;

  if (!locales.includes(locale)) {
    notFound();
  }

  const dictionary = await getDictionary(locale);
  const { home, navigation, products } = dictionary;

  const navLinks = visibleNavLinks(navigation.links).map((link) => ({
    ...link,
    href: resolveDestination(link.href, locale),
  }));

  const heroFallback = {
    eyebrow: home.hero.eyebrow,
    headline: home.hero.headline,
    description: home.hero.description,
    primaryCta: {
      ...home.hero.primaryCta,
      href: resolveDestination(home.hero.primaryCta.href, locale),
    },
    secondaryCta: {
      ...home.hero.secondaryCta,
      href: resolveDestination(home.hero.secondaryCta.href, locale),
    },
    sceneAlt: home.hero.sceneAlt,
    scrollCue: home.hero.scrollCue,
  };

  // Server-side data for the sections below the hero — direct imports from the
  // `server-only` catalog helpers (no HTTP round-trip); cached via
  // `unstable_cache` (tag "products", see `@/server/lib/public-products`).
  const [productStats, categoryList, featuredProducts] = await Promise.all([
    getPublicProductList({ page: 1, perPage: 1 }),
    getPublicCategoryList(),
    getFeaturedProducts(8),
  ]);

  return (
    <>
      <HomeHero
        brand={home.brand}
        fallback={heroFallback}
        navLinks={navLinks}
        menuLabels={{ open: navigation.menu, close: navigation.close }}
        locale={locale}
      />
      <HomeAbout
        content={home.about}
        ctaHref={resolveDestination(home.about.cta.href, locale)}
        stats={{ totalProducts: productStats.total, totalCategories: categoryList.length }}
      />
      <HomeCategories
        content={home.categories}
        categorySlugs={categoryList.map((category) => category.slug)}
        locale={locale}
        ctaHref={resolveDestination(home.categories.cta.href, locale)}
      />
      <HomeFeatured
        content={home.featured}
        items={featuredProducts}
        locale={locale}
        ctaHref={resolveDestination(home.featured.cta.href, locale)}
        cardContent={products.card}
        badgeLabels={products.badges}
      />
      <HomePortalCta
        content={home.portalCta}
        ctaHref={resolveDestination(home.portalCta.cta.href, locale)}
      />
    </>
  );
}
