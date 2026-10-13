import "server-only";
import type { Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/get-dictionary";
import { getPublicCategoryCounts, getPublicCategoryList } from "@/server/lib/public-products";
import { getContactInfo, getSocialLinks, type SocialLinks } from "@/server/lib/site-settings";
import { buildOrganization, type OrganizationInput } from "@/modules/ai/lib/json-ld";

export type CategoryFact = { slug: string; name: string; count: number };

export type SiteFacts = {
  locale: Locale;
  dictionary: Dictionary;
  contact: { phone: string; email: string; addressHeadquarters: string; addressPlant: string };
  social: SocialLinks;
  /** Só categorias ativas com produto publicado, na ordem do catálogo. */
  categories: CategoryFact[];
};

/** Logo escura sobre transparência: legível no fundo branco dos buscadores. */
export const ORGANIZATION_LOGO_PATH = "/images/logos/roco-logo-blue.png";

/**
 * Fatos da empresa e do catálogo num lugar só — a FONTE ÚNICA do JSON-LD, da
 * página Sobre, do `llms.txt` e do servidor MCP (spec 003). Tudo vem do que o
 * site já mostra: dicionário, `site_settings` (rodapé) e o catálogo público.
 *
 * Banco fora do ar não derruba quem chama: contato e catálogo voltam vazios e
 * cada consumidor omite o que faltar (nunca inventa).
 */
export async function getSiteFacts(locale: Locale): Promise<SiteFacts> {
  const dictionary = await getDictionary(locale);

  const [contact, social, categoryList, counts] = await Promise.all([
    getContactInfo().catch(() => null),
    getSocialLinks().catch(() => ({}) as SocialLinks),
    getPublicCategoryList().catch(() => []),
    getPublicCategoryCounts().catch(() => ({}) as Record<string, number>),
  ]);

  const categories = categoryList
    .map((category) => ({
      slug: category.slug,
      name: (locale === "en" && category.nameEn) || category.namePt,
      count: counts[category.slug] ?? 0,
    }))
    .filter((category) => category.count > 0);

  return {
    locale,
    dictionary,
    contact: {
      phone: contact?.phone ?? "",
      email: contact?.email ?? "",
      addressHeadquarters: contact?.addressMatriz ?? "",
      addressPlant: contact?.addressFilial ?? "",
    },
    social,
    categories,
  };
}

/** Links oficiais (`sameAs`) — só URLs http(s) completas. */
export function officialProfiles(social: SocialLinks): string[] {
  return [social.instagram, social.linkedin, social.youtube]
    .filter((url): url is string => typeof url === "string" && /^https?:\/\//i.test(url));
}

/** Linhas de produto da vitrine da home (Hidrossanitários, Hidráulica…). */
export function productLines(dictionary: Dictionary): string[] {
  return dictionary.home.categories.items.map((item) => item.label);
}

export function organizationInput(facts: SiteFacts): OrganizationInput {
  const { dictionary } = facts;
  const organization = dictionary.ai.organization;
  const gptw = dictionary.footer.certifications.items.map((item) => `${item.label} (${item.note})`);

  return {
    name: dictionary.navigation.brand,
    legalName: organization.legalName,
    description: dictionary.seo.description,
    slogan: dictionary.footer.tagline,
    foundingYear: organization.foundingYear,
    email: facts.contact.email || undefined,
    phone: facts.contact.phone || undefined,
    addressHeadquarters: facts.contact.addressHeadquarters || undefined,
    plantName: organization.plantName,
    plantDescription: facts.contact.addressPlant || undefined,
    sameAs: officialProfiles(facts.social),
    // Linhas de produto da vitrine (nomes de marketing); as categorias do ERP
    // vêm em caixa alta e repetiriam as mesmas famílias.
    knowsAbout: productLines(dictionary),
    awards: gptw,
    areaServed: organization.areaServed,
    logoPath: ORGANIZATION_LOGO_PATH,
    disambiguatingDescription: organization.homonyms,
  };
}

export function organizationJsonLd(facts: SiteFacts) {
  return buildOrganization(organizationInput(facts));
}
