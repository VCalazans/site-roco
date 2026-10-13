import "server-only";
import { absoluteUrl } from "@/core/config/metadata";
import {
  aboutPath,
  catalogPath,
  contactPath,
  productsPath,
  representativesPath,
  siteLinks,
} from "@/core/config/site";
import type { Locale } from "@/i18n/config";
import type { LlmsInput, LlmsProduct } from "@/modules/ai/lib/llms";
import { MCP_TOOL_NAMES } from "@/modules/ai/lib/mcp-tools";
import { MCP_PATH } from "@/modules/ai/server/mcp-server";
import { getSiteFacts, officialProfiles, productLines } from "@/modules/ai/server/site-facts";
import { getPublicCategoryList, getPublicProductIndex } from "@/server/lib/public-products";

/** Entrada do `llms.txt` a partir da fonte única (`getSiteFacts`). */
export async function getLlmsInput(locale: Locale): Promise<LlmsInput> {
  const facts = await getSiteFacts(locale);
  const { dictionary } = facts;

  return {
    copy: dictionary.ai.llms,
    organization: dictionary.ai.organization,
    brand: dictionary.navigation.brand,
    description: dictionary.seo.description,
    productLines: productLines(dictionary),
    categories: facts.categories.map((category) => ({
      name: category.name,
      count: category.count,
      url: absoluteUrl(`${productsPath(locale)}?category=${encodeURIComponent(category.slug)}`),
    })),
    contact: facts.contact,
    profiles: officialProfiles(facts.social),
    urls: {
      site: absoluteUrl("/"),
      home: absoluteUrl(`/${locale}`),
      products: absoluteUrl(productsPath(locale)),
      about: absoluteUrl(aboutPath(locale)),
      contact: absoluteUrl(contactPath(locale)),
      representatives: absoluteUrl(representativesPath(locale)),
      catalog: siteLinks.catalog || absoluteUrl(catalogPath(locale)),
      full: absoluteUrl("/llms-full.txt"),
      mcp: absoluteUrl(MCP_PATH),
    },
    mcpTools: [...MCP_TOOL_NAMES],
  };
}

/** Uma linha por produto publicado (SKU, nome, categorias, página). */
export async function getLlmsProducts(locale: Locale): Promise<LlmsProduct[]> {
  const [index, categoryList] = await Promise.all([getPublicProductIndex(), getPublicCategoryList()]);
  const names = new Map(
    categoryList.map((category) => [category.slug, (locale === "en" && category.nameEn) || category.namePt])
  );
  return index.map((product) => ({
    sku: product.sku,
    name: (locale === "en" && product.nameEn) || product.namePt,
    categories: product.categories.map((slug) => names.get(slug) ?? slug),
    url: absoluteUrl(`${productsPath(locale)}/${encodeURIComponent(product.slug)}`),
  }));
}
