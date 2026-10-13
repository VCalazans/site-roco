import "server-only";
import { absoluteUrl } from "@/core/config/metadata";
import {
  aboutPath,
  catalogPath,
  contactPath,
  productsPath,
  quotePath,
  representativesPath,
  siteLinks,
} from "@/core/config/site";
import { getDictionary } from "@/i18n/get-dictionary";
import type { CatalogSource, McpLocale, ProductDetail, ProductSummary } from "@/modules/ai/lib/mcp-tools";
import { toInternationalPhone } from "@/modules/ai/lib/json-ld";
import { getSiteFacts, officialProfiles, productLines } from "@/modules/ai/server/site-facts";
import { withLeadOrigin } from "@/shared/lib/lead-origin";
import { interpolate } from "@/shared/lib/interpolate";
import { describePackaging } from "@/shared/lib/packaging";
import {
  getPublicCategoryList,
  getPublicProductBySku,
  getPublicProductBySlug,
  getPublicProductIndex,
  getPublicProductList,
} from "@/server/lib/public-products";

/**
 * Fonte de dados do servidor MCP (spec 003) — só o catálogo PÚBLICO e os fatos
 * que o site já mostra (`getSiteFacts`). Os links que voltam para o site levam
 * `?origem=assistente-ia` nas páginas de captura, para o RD Station separar o
 * lead que chegou por uma IA.
 */

type PublicProduct = NonNullable<Awaited<ReturnType<typeof getPublicProductBySlug>>>;
type ListedProduct = Awaited<ReturnType<typeof getPublicProductList>>["items"][number];

const AI_ORIGIN = "assistente-ia" as const;

function productName(product: { namePt: string; nameEn: string | null }, locale: McpLocale): string {
  return (locale === "en" && product.nameEn) || product.namePt;
}

function categoryName(category: { namePt: string; nameEn: string | null }, locale: McpLocale): string {
  return (locale === "en" && category.nameEn) || category.namePt;
}

function productUrl(slug: string, locale: McpLocale): string {
  return absoluteUrl(`${productsPath(locale)}/${encodeURIComponent(slug)}`);
}

function categoryUrl(slug: string, locale: McpLocale): string {
  return absoluteUrl(`${productsPath(locale)}?category=${encodeURIComponent(slug)}`);
}

function quoteUrl(slug: string, locale: McpLocale): string {
  return absoluteUrl(withLeadOrigin(`${contactPath(locale)}?produto=${encodeURIComponent(slug)}&assunto=quote`, AI_ORIGIN));
}

function summarize(product: ListedProduct | PublicProduct, locale: McpLocale): ProductSummary {
  const image = product.images[0]?.url;
  return {
    sku: product.sku,
    nome: productName(product, locale),
    categorias: product.categories.map((category) => categoryName(category, locale)),
    campeao_de_vendas: product.bestSeller,
    url: productUrl(product.slug, locale),
    ...(image ? { imagem: image } : {}),
  };
}

export const catalogSource: CatalogSource = {
  async company(locale) {
    const facts = await getSiteFacts(locale);
    const { dictionary, contact } = facts;
    const organization = dictionary.ai.organization;
    const phone = contact.phone ? toInternationalPhone(contact.phone) : undefined;

    return {
      nome: dictionary.navigation.brand,
      razao_social: organization.legalName,
      descricao: interpolate(dictionary.ai.llms.summary, {
        legalName: organization.legalName,
        foundingYear: organization.foundingYear,
      }),
      nao_confundir_com: organization.homonyms,
      fundacao: organization.foundingYear,
      matriz: contact.addressHeadquarters || undefined,
      unidade_fabril: contact.addressPlant || undefined,
      mercados: organization.areaServed,
      linhas_de_produto: productLines(dictionary),
      categorias: facts.categories.map((category) => ({ nome: category.name, produtos: category.count })),
      certificacoes: dictionary.footer.certifications.items.map((item) => `${item.label} — ${item.note}`),
      contato_comercial: {
        email: contact.email || undefined,
        telefone_whatsapp: phone,
        pagina_de_contato: absoluteUrl(withLeadOrigin(contactPath(locale), AI_ORIGIN)),
      },
      perfis_oficiais: officialProfiles(facts.social),
      site: absoluteUrl(`/${locale}`),
      pagina_sobre: absoluteUrl(aboutPath(locale)),
      precos: dictionary.ai.llms.notFor,
    };
  },

  async howToBuy(locale) {
    const dictionary = await getDictionary(locale);
    const links = {
      contactUrl: absoluteUrl(withLeadOrigin(contactPath(locale), AI_ORIGIN)),
      catalogUrl: siteLinks.catalog || absoluteUrl(catalogPath(locale)),
      representativesUrl: absoluteUrl(representativesPath(locale)),
    };
    return {
      passos: dictionary.ai.llms.howToBuy.map((step) => interpolate(step, links)),
      aviso: dictionary.ai.llms.notFor,
      links: {
        pedir_orcamento: links.contactUrl,
        lista_de_orcamento: absoluteUrl(quotePath(locale)),
        catalogo_online: links.catalogUrl,
        catalogo_de_produtos: absoluteUrl(productsPath(locale)),
        seja_representante: links.representativesUrl,
      },
    };
  },

  async categories(locale) {
    const facts = await getSiteFacts(locale);
    return facts.categories.map((category) => ({
      slug: category.slug,
      nome: category.name,
      produtos: category.count,
      url: categoryUrl(category.slug, locale),
    }));
  },

  async categorySlugs() {
    return (await getPublicCategoryList()).map((category) => category.slug);
  },

  async search({ locale, terms, categories, bestSeller, limit }) {
    const result = await getPublicProductList({
      categories,
      searchTerms: terms,
      bestSeller,
      page: 1,
      perPage: limit,
    });
    return { total: result.total, itens: result.items.map((product) => summarize(product, locale)) };
  },

  async product({ locale, slug, sku }) {
    // Só consulta (e só cria entrada de cache) para slug/SKU que EXISTEM no índice
    // público, ele próprio cacheado: valor inventado não vira chave nova de
    // `unstable_cache` nem consulta ao banco (revisão de segurança, spec 003).
    const index = await getPublicProductIndex();
    const known = index.find((item) => (slug ? item.slug === slug : item.sku === sku));
    if (!known) return null;
    const product = slug ? await getPublicProductBySlug(known.slug) : await getPublicProductBySku(known.sku);
    if (!product) return null;

    const { products } = await getDictionary(locale);
    const description = (locale === "en" ? product.descriptionEn : product.descriptionPt) ?? product.descriptionPt;

    const detail: ProductDetail = {
      ...summarize(product, locale),
      ...(description ? { descricao: description } : {}),
      ...(product.ean ? { ean: product.ean } : {}),
      embalagens: product.packagings.map((packaging) => {
        const described = describePackaging(packaging, products.packagingInfo);
        return {
          descricao: `${described.title} — ${described.detail}`,
          ...(packaging.barcodeEan13 ? { ean: packaging.barcodeEan13 } : {}),
        };
      }),
      imagens: product.images.map((image) => image.url),
      categorias_detalhe: product.categories.map((category) => ({
        slug: category.slug,
        nome: categoryName(category, locale),
        url: categoryUrl(category.slug, locale),
      })),
      solicitar_orcamento_url: quoteUrl(product.slug, locale),
    };
    return detail;
  },
};
