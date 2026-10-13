import type { MetadataRoute } from "next";
import { absoluteUrl, LOCALE_LANGUAGE_TAGS } from "@/core/config/metadata";
import {
  ABOUT_SEGMENT,
  CATALOG_SEGMENT,
  CONTACT_SEGMENT,
  PRODUCTS_SEGMENT,
  REPRESENTATIVES_SEGMENT,
} from "@/core/config/site";
import { locales } from "@/i18n/config";
import {
  getPublicCategoryCounts,
  getPublicCategoryList,
  getPublicProductIndex,
} from "@/server/lib/public-products";

/**
 * Lido do banco a cada requisição (com o cache da tag `products`): no `next
 * build` não há banco, e um sitemap gerado no build ficaria parado até o
 * próximo deploy.
 */
export const dynamic = "force-dynamic";

type Entry = MetadataRoute.Sitemap[number];

/** Uma URL por idioma, cada uma com as alternativas (hreflang) das duas. */
function localized(path: string, extra: Omit<Entry, "url" | "alternates"> = {}): Entry[] {
  const languages = {
    [LOCALE_LANGUAGE_TAGS.pt]: absoluteUrl(`/pt${path}`),
    [LOCALE_LANGUAGE_TAGS.en]: absoluteUrl(`/en${path}`),
    "x-default": absoluteUrl(`/pt${path}`),
  };
  return locales.map((locale) => ({
    url: absoluteUrl(`/${locale}${path}`),
    alternates: { languages },
    ...extra,
    priority: locale === "pt" ? extra.priority : extra.priority === undefined ? undefined : Math.round(extra.priority * 80) / 100,
  }));
}

/**
 * Sitemap com o catálogo inteiro (spec 003): até 2026-10 ele listava só as
 * páginas fixas, e os ~740 produtos dependiam de o robô achar os links. A
 * decisão de 2026-08-11 de não enumerar produtos foi revista — o custo é uma
 * consulta de índice cacheada; `lastModified` é o `updated_at` real.
 * `/orcamento` fica de fora (estado do visitante, bloqueado no robots).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = [
    ...localized("", { changeFrequency: "weekly", priority: 1 }),
    ...localized(`/${PRODUCTS_SEGMENT}`, { changeFrequency: "daily", priority: 0.9 }),
    ...localized(`/${ABOUT_SEGMENT}`, { changeFrequency: "monthly", priority: 0.7 }),
    ...localized(`/${CATALOG_SEGMENT}`, { changeFrequency: "monthly", priority: 0.6 }),
    ...localized(`/${REPRESENTATIVES_SEGMENT}`, { changeFrequency: "monthly", priority: 0.6 }),
    ...localized(`/${CONTACT_SEGMENT}`, { changeFrequency: "monthly", priority: 0.6 }),
  ];

  try {
    const [index, categoryList, counts] = await Promise.all([
      getPublicProductIndex(),
      getPublicCategoryList(),
      getPublicCategoryCounts(),
    ]);

    const categoryPages = categoryList
      .filter((category) => (counts[category.slug] ?? 0) > 0)
      .flatMap((category) =>
        localized(`/${PRODUCTS_SEGMENT}?category=${encodeURIComponent(category.slug)}`, {
          changeFrequency: "weekly",
          priority: 0.8,
        })
      );

    const productPages = index.flatMap((product) =>
      localized(`/${PRODUCTS_SEGMENT}/${encodeURIComponent(product.slug)}`, {
        lastModified: product.updatedAt,
        changeFrequency: "weekly",
        priority: product.bestSeller ? 0.8 : 0.7,
      })
    );

    return [...pages, ...categoryPages, ...productPages];
  } catch (error) {
    // Banco fora: o sitemap ainda sai com as páginas fixas (melhor que 500).
    console.error("[sitemap] catálogo indisponível:", error instanceof Error ? error.message : error);
    return pages;
  }
}
