import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetailView } from "@/modules/products/components/product-detail-view";
import { locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import {
  RELATED_PRODUCTS_LIMIT,
  getAdjacentProducts,
  getPublicProductBySlug,
  getPublicProductList,
} from "@/server/lib/public-products";

type PageProps = {
  params: Promise<{ locale: Locale; slug: string }>;
};

/**
 * SEM `generateStaticParams` (decisão registrada em decisionLog): o catálogo
 * tem 700+ produtos que mudam via sync ERP — enumerar cada slug em build
 * inflaria o build e ficaria desatualizado entre syncs. A rota renderiza
 * dinamicamente por request.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;

  if (!locales.includes(locale)) {
    notFound();
  }

  const dictionary = await getDictionary(locale);
  const product = await getPublicProductBySlug(slug);

  if (!product) {
    return {
      title: dictionary.products.detail.notFoundTitle,
      description: dictionary.products.detail.notFoundDescription,
    };
  }

  const name = locale === "en" && product.nameEn ? product.nameEn : product.namePt;
  const description = (locale === "en" ? product.descriptionEn : product.descriptionPt) ?? dictionary.products.seo.description;

  return {
    title: `${name} — ${dictionary.navigation.brand}`,
    description,
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { locale, slug } = await params;

  if (!locales.includes(locale)) {
    notFound();
  }

  const dictionary = await getDictionary(locale);
  const { products, cart, home } = dictionary;

  const product = await getPublicProductBySlug(slug);

  // `notFound()` renders the nearest `not-found.tsx` (same directory) AND
  // sets a real HTTP 404 — a bare custom JSX return here would render the
  // same visual but serve status 200 (soft-404, bad for SEO/monitoring).
  if (!product) {
    notFound();
  }

  const primaryCategorySlug = product.categories[0]?.slug ?? null;
  const [relatedResult, adjacent] = await Promise.all([
    primaryCategorySlug
      ? // Relacionados: mesma categoria, sem o próprio produto (pedido junto e descartado).
        getPublicProductList({ categories: [primaryCategorySlug], perPage: RELATED_PRODUCTS_LIMIT + 1 })
      : Promise.resolve({ items: [] as Awaited<ReturnType<typeof getPublicProductList>>["items"] }),
    getAdjacentProducts(product.sku, primaryCategorySlug),
  ]);
  const related = relatedResult.items.filter((item) => item.slug !== product.slug).slice(0, RELATED_PRODUCTS_LIMIT);

  return (
    <ProductDetailView
      product={product}
      related={related}
      adjacent={adjacent}
      locale={locale}
      products={products}
      cart={cart}
      relatedCarouselLabels={home.featured.carousel}
    />
  );
}
