import { Fragment, type ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { HomeHero } from "@/modules/home/components/home-hero";
import { HomeFacade } from "@/modules/home/components/home-facade";
import { HomeAbout } from "@/modules/home/components/home-about";
import { HomeCategories } from "@/modules/home/components/home-categories";
import { HomeFeatured } from "@/modules/home/components/home-featured";
import { HomePortalCta } from "@/modules/home/components/home-portal-cta";
import type { HomeSectionId } from "@/modules/home/lib/home-content";
import { resolveCtaHref } from "@/core/config/site";
import { locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getHomeContent } from "@/server/lib/home-content";
import { getFeaturedProducts, getPublicCategoryList, getPublicProductList } from "@/server/lib/public-products";

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

/**
 * Home. O hero (slides em `/portal/hero`) é fixo no topo; as demais seções
 * seguem a ORDEM e a VISIBILIDADE definidas no painel (`/portal/pagina-inicial`)
 * e o conteúdo de cada uma vem de `getHomeContent` — texto salvo no painel no
 * idioma da página ou, vazio, o padrão do dicionário (spec 001, RF17–RF20).
 */
export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;

  if (!locales.includes(locale)) {
    notFound();
  }

  // Conteúdo editável + catálogo são SEMPRE do momento da requisição. Sem
  // isto, o `next build` tentava pré-renderizar a home (por causa do
  // `generateStaticParams` de locale), batia no banco inexistente do build e
  // despejava stack traces de "falha ao ler o conteúdo" no log de deploy —
  // ruído que parece erro. A rota já era dinâmica (o layout raiz lê cookie).
  await connection();

  const dictionary = await getDictionary(locale);
  const { home, products, cart } = dictionary;

  const content = await getHomeContent(locale, home);

  // Dados do catálogo para as seções abaixo do hero — imports diretos dos
  // helpers `server-only` (sem round-trip HTTP), cacheados via
  // `unstable_cache` (tag "products").
  const [productStats, categoryList, featuredProducts] = await Promise.all([
    getPublicProductList({ page: 1, perPage: 1 }),
    getPublicCategoryList(),
    getFeaturedProducts(content.featured.limit),
  ]);

  const cardContent = {
    viewDetails: products.card.viewDetails,
    codeLabel: products.card.codeLabel,
    bestSeller: products.card.bestSeller,
    bestSellerShort: products.card.bestSellerShort,
  };

  const sections: Record<HomeSectionId, () => ReactNode> = {
    facade: () => (
      <HomeFacade
        content={content.facade}
        ctaHref={content.facade.cta ? resolveCtaHref(content.facade.cta.href, locale, "home-fachada") : null}
      />
    ),
    about: () => (
      <HomeAbout
        content={content.about}
        ctaHref={resolveCtaHref(content.about.cta.href, locale, "home-sobre")}
        stats={{ totalProducts: productStats.total, totalCategories: categoryList.length }}
      />
    ),
    categories: () => (
      <HomeCategories
        content={content.categories}
        categorySlugs={categoryList.map((category) => category.slug)}
        locale={locale}
        ctaHref={resolveCtaHref(content.categories.cta.href, locale, "home-categorias")}
        carouselLabels={home.categories.carousel}
      />
    ),
    featured: () => (
      <HomeFeatured
        content={content.featured}
        items={featuredProducts}
        locale={locale}
        ctaHref={resolveCtaHref(content.featured.cta.href, locale, "home-destaques")}
        cardContent={cardContent}
        badgeLabels={products.badges}
        cartLabels={cart.addButton}
        carouselLabels={home.featured.carousel}
      />
    ),
    portalCta: () => (
      <HomePortalCta
        content={content.portalCta}
        ctaHref={resolveCtaHref(content.portalCta.cta.href, locale, "home-portal")}
        brand={home.brand}
      />
    ),
  };

  return (
    <>
      <HomeHero
        brand={home.brand}
        fallback={{
          eyebrow: home.hero.eyebrow,
          headline: home.hero.headline,
          description: home.hero.description,
          primaryCta: home.hero.primaryCta,
          secondaryCta: home.hero.secondaryCta,
          scrollCue: home.hero.scrollCue,
          carousel: home.hero.carousel,
        }}
        locale={locale}
      />
      {content.sections.map((id) => (
        <Fragment key={id}>{sections[id]()}</Fragment>
      ))}
    </>
  );
}
