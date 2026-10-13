import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { buildAlternates } from "@/core/config/metadata";
import {
  ABOUT_SEGMENT,
  aboutPath,
  contactPath,
  productsPath,
  representativesPath,
} from "@/core/config/site";
import { locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { AboutPage } from "@/modules/about/components/about-page";
import { buildAboutPage, buildBreadcrumbList } from "@/modules/ai/lib/json-ld";
import { getSiteFacts } from "@/modules/ai/server/site-facts";
import { JsonLd } from "@/shared/components/seo/json-ld";
import { withLeadOrigin } from "@/shared/lib/lead-origin";
import { getHomeContent } from "@/server/lib/home-content";
import { getPublicProductList } from "@/server/lib/public-products";
import { getPublicCertifications } from "@/server/lib/certifications";

type PageProps = {
  params: Promise<{ locale: Locale }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;

  if (!locales.includes(locale)) {
    notFound();
  }

  const { about } = await getDictionary(locale);
  return {
    title: about.seo.title,
    description: about.seo.description,
    alternates: buildAlternates(locale, `/${ABOUT_SEGMENT}`),
  };
}

/**
 * Página institucional (spec 003): os fatos da empresa numa página só, iguais
 * ao JSON-LD `Organization` e ao `llms.txt`. Por requisição — endereços,
 * categorias e textos editáveis vêm do banco.
 */
export default async function AboutRoute({ params }: PageProps) {
  const { locale } = await params;

  if (!locales.includes(locale)) {
    notFound();
  }

  await connection();

  const facts = await getSiteFacts(locale);
  const { dictionary } = facts;
  const [homeContent, productStats, certificationList] = await Promise.all([
    getHomeContent(locale, dictionary.home),
    getPublicProductList({ page: 1, perPage: 1 }).catch(() => ({ total: 0 })),
    getPublicCertifications(locale),
  ]);

  const structuredData = [
    buildAboutPage({ name: dictionary.about.seo.title, path: aboutPath(locale), description: dictionary.about.seo.description }),
    buildBreadcrumbList([
      { name: dictionary.products.detail.breadcrumbHome, path: `/${locale}` },
      { name: dictionary.about.breadcrumb, path: aboutPath(locale) },
    ]),
  ];

  return (
    <>
      <JsonLd data={structuredData} />
      <AboutPage
        about={dictionary.about}
        organization={dictionary.ai.organization}
        certifications={certificationList}
        paragraphs={homeContent.about.paragraphs}
        contact={facts.contact}
        categories={facts.categories}
        totalProducts={productStats.total}
        links={{
          products: productsPath(locale),
          contact: withLeadOrigin(contactPath(locale), "sobre"),
          representatives: representativesPath(locale),
          category: (slug) => `${productsPath(locale)}?category=${encodeURIComponent(slug)}`,
        }}
      />
    </>
  );
}
