import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ProductsExplorer } from "@/modules/products/components/products-explorer";
import { locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getPublicCategoryList, getPublicProductList } from "@/server/lib/public-products";
import { SiteHeader } from "@/shared/components/nav";
import { siteNavLinks } from "@/shared/lib/nav";

type PageProps = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ category?: string; search?: string; page?: string }>;
};

/**
 * SEM `generateStaticParams`/`dynamicParams` de propósito (decisão registrada
 * em decisionLog): esta página lê filtros via querystring e busca no banco a
 * cada request — diferente das demais páginas de `(site)`, que só variam por
 * locale. Sem `generateStaticParams`, o Next 16 renderiza a rota
 * dinamicamente por request (o comportamento default do App Router para uma
 * rota que não declara parâmetros estáticos).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;

  if (!locales.includes(locale)) {
    notFound();
  }

  const dictionary = await getDictionary(locale);
  return {
    title: dictionary.products.seo.title,
    description: dictionary.products.seo.description,
  };
}

export default async function ProductsPage({ params, searchParams }: PageProps) {
  const { locale } = await params;

  if (!locales.includes(locale)) {
    notFound();
  }

  const sp = await searchParams;
  const category = sp.category?.trim() || "";
  // Mesmo teto de `getPublicProductList` (MAX_SEARCH_LENGTH) — o input do
  // explorer deve refletir o termo que o server de fato usou.
  const search = (sp.search?.trim() || "").slice(0, 80);
  const requestedPage = Number(sp.page);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;

  const dictionary = await getDictionary(locale);
  const { navigation, products } = dictionary;

  const navLinks = siteNavLinks(navigation.links, locale);

  // Initial load via direct import (SSR, sem HTTP) — buscas/filtros
  // subsequentes no cliente usam `GET /api/products` (ver `ProductsExplorer`).
  const [initialResult, categoryList] = await Promise.all([
    getPublicProductList({ category: category || undefined, search: search || undefined, page }),
    getPublicCategoryList(),
  ]);

  return (
    <div className="relative min-h-[100svh] w-full bg-[#05070b]">
      <SiteHeader
        brand={navigation.brand}
        links={navLinks}
        menuLabels={{ open: navigation.menu, close: navigation.close }}
        locale={locale}
        controls={{ language: navigation.language, portalLogin: navigation.portalLogin }}
      />

      {/* Faixa decorativa com a cena extraída de
          `docs/Layout pag Produtos_OK_01.psd` (nav + título "Produtos" +
          molduras neon vazias — ver preview em
          `docs/produtos-listagem-preview.png`). O PSD não desenha o restante
          do layout (grid, filtros, paginação); a partir daqui a composição é
          livre, seguindo a linguagem visual já estabelecida no site. */}
      <div className="relative h-56 w-full overflow-hidden pt-20 sm:h-64 md:h-72 md:pt-28">
        <Image
          src="/images/produtos/listagem-scene.jpg"
          alt=""
          aria-hidden
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#05070b]/30 via-[#05070b]/70 to-[#05070b]" />
        <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-end px-5 pb-8 sm:px-6">
          <h1 className="text-glow-soft font-display text-h1 text-white">{products.listing.headline}</h1>
          <p className="mt-2 max-w-2xl text-lede text-white/75">{products.listing.description}</p>
        </div>
      </div>

      <ProductsExplorer
        locale={locale}
        initialItems={initialResult.items}
        initialTotal={initialResult.total}
        initialPage={initialResult.page}
        perPage={initialResult.perPage}
        categories={categoryList}
        initialFilters={{ category, search }}
        content={products.listing}
        cardContent={products.card}
        badgeLabels={products.badges}
      />
    </div>
  );
}
