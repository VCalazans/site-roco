import { absoluteUrl } from "@/core/config/metadata";

/**
 * Dados estruturados (schema.org em JSON-LD) do site público — spec 003.
 *
 * Módulo PURO: recebe os dados já resolvidos (dicionário, `site_settings`,
 * catálogo) e devolve objetos. A mesma fonte das páginas — nada aqui é texto
 * paralelo mantido à mão.
 */

/** `@id` estável da organização: os outros nós apontam para ele. */
export const ORGANIZATION_ID = absoluteUrl("/#organization");
export const WEBSITE_ID = absoluteUrl("/#website");

/**
 * Serializa para `<script type="application/ld+json">` sem deixar um valor
 * fechar a tag: `<` vira `<` (e U+2028/U+2029, que quebram JS antigo,
 * também). Todo JSON-LD da página passa por aqui.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/** Remove chaves `undefined`, `null`, `""` e listas vazias — JSON-LD limpo. */
function compact<T extends Record<string, unknown>>(node: T): T {
  return Object.fromEntries(
    Object.entries(node).filter(([, value]) => {
      if (value === undefined || value === null || value === "") return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    })
  ) as T;
}

/**
 * Endereço brasileiro em texto livre ("Rua X, 853 - Bairro, Cidade - UF, CEP
 * 00000-000") → `PostalAddress`. Melhor esforço: o que não casar fica inteiro
 * em `streetAddress`, nunca inventado.
 */
export function parseBrazilianAddress(raw: string): Record<string, string | undefined> | null {
  const text = raw.trim();
  if (!text) return null;

  const postalCode = text.match(/\b(\d{5})-?(\d{3})\b/);
  const cityUf = text.match(/,\s*([^,]+?)\s*[-–—\/]\s*([A-Z]{2})\b/);
  const street = cityUf ? text.slice(0, cityUf.index).trim() : text.replace(/,?\s*\bCEP\b.*$/i, "").trim();

  return compact({
    "@type": "PostalAddress",
    streetAddress: street || text,
    addressLocality: cityUf?.[1]?.trim(),
    addressRegion: cityUf?.[2],
    postalCode: postalCode ? `${postalCode[1]}-${postalCode[2]}` : undefined,
    addressCountry: "BR",
  });
}

/**
 * Telefone brasileiro → E.164 (`+55…`). 10–11 dígitos = número nacional (DDD +
 * número — o DDD 55 de Santa Maria/RS não é confundido com o DDI); 12–13
 * dígitos começando com 55 = já tem o DDI. Fora disso, `undefined`.
 */
export function toInternationalPhone(raw: string): string | undefined {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return `+${digits}`;
  return undefined;
}

export type OrganizationInput = {
  name: string;
  legalName: string;
  description: string;
  slogan?: string;
  foundingYear?: string;
  email?: string;
  phone?: string;
  addressHeadquarters?: string;
  plantName?: string;
  plantDescription?: string;
  sameAs: string[];
  knowsAbout: string[];
  awards: string[];
  areaServed: string[];
  logoPath: string;
  disambiguatingDescription?: string;
};

export function buildOrganization(input: OrganizationInput) {
  const phone = input.phone ? toInternationalPhone(input.phone) : undefined;
  const address = input.addressHeadquarters ? parseBrazilianAddress(input.addressHeadquarters) : null;

  return compact({
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: input.name,
    legalName: input.legalName,
    url: absoluteUrl("/"),
    logo: absoluteUrl(input.logoPath),
    image: absoluteUrl(input.logoPath),
    description: input.description,
    disambiguatingDescription: input.disambiguatingDescription,
    slogan: input.slogan,
    foundingDate: input.foundingYear,
    email: input.email,
    telephone: phone,
    address: address ?? undefined,
    location: input.plantName
      ? compact({
          "@type": "Place",
          name: input.plantName,
          description: input.plantDescription,
        })
      : undefined,
    areaServed: input.areaServed.map((name) => ({ "@type": "Country", name })),
    knowsAbout: input.knowsAbout,
    award: input.awards,
    sameAs: input.sameAs,
    contactPoint: phone || input.email
      ? [
          compact({
            "@type": "ContactPoint",
            contactType: "sales",
            telephone: phone,
            email: input.email,
            // Só o idioma confirmado do atendimento; outros só com confirmação da ROCO.
            availableLanguage: ["Portuguese"],
            areaServed: "BR",
          }),
        ]
      : undefined,
  });
}

/** `WebSite` com a busca do catálogo (`?search=`) como `SearchAction`. */
export function buildWebSite(input: { name: string; locale: string; searchPath: string; languages: string[] }) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: input.name,
    url: absoluteUrl("/"),
    inLanguage: input.languages,
    publisher: { "@id": ORGANIZATION_ID },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${absoluteUrl(input.searchPath)}?search={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export type BreadcrumbItem = { name: string; path: string };

export function buildBreadcrumbList(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export type ItemListEntry = { name: string; path: string; image?: string };

export function buildItemList(input: { name: string; items: ItemListEntry[] }) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: input.name,
    numberOfItems: input.items.length,
    itemListElement: input.items.map((item, index) =>
      compact({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        url: absoluteUrl(item.path),
        image: item.image,
      })
    ),
  };
}

/** EAN-13 válido (dígito verificador conferido) — só esses viram `gtin13`. */
export function isValidEan13(value: string | null | undefined): value is string {
  if (!value || !/^\d{13}$/.test(value)) return false;
  const digits = value.split("").map(Number);
  const sum = digits.slice(0, 12).reduce((acc, digit, index) => acc + digit * (index % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10 === digits[12];
}

export type ProductInput = {
  name: string;
  description?: string | null;
  sku: string;
  ean?: string | null;
  path: string;
  images: string[];
  categories: string[];
  /** Uma descrição legível por embalagem ("Blister — 12 unidades por embalagem") + EAN, quando há. */
  packagings: { label: string; ean?: string | null }[];
  bestSellerLabel?: string;
  locale: string;
};

/**
 * `Product` SEM `offers`: o site não tem preço público, e preço inventado é
 * proibido. Sem oferta o Google não mostra resultado enriquecido de produto —
 * o ganho é a IA e o Knowledge Graph entenderem fabricante, código e
 * embalagens. Cada embalagem vira um `PropertyValue` com o EAN dela (quando
 * válido), para o código impresso na caixa levar a esta página.
 */
export function buildProduct(input: ProductInput) {
  const url = absoluteUrl(input.path);
  const gtin = isValidEan13(input.ean) ? input.ean : undefined;
  const properties = [
    ...input.packagings.map((packaging) =>
      compact({
        "@type": "PropertyValue",
        name: "Embalagem",
        value: packaging.label,
        propertyID: isValidEan13(packaging.ean) ? "gtin13" : undefined,
        identifier: isValidEan13(packaging.ean) ? packaging.ean : undefined,
      })
    ),
    ...(input.bestSellerLabel ? [{ "@type": "PropertyValue", name: "Selo", value: input.bestSellerLabel }] : []),
  ];

  return compact({
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name: input.name,
    description: input.description ?? undefined,
    sku: input.sku,
    mpn: input.sku,
    gtin13: gtin,
    url,
    image: input.images,
    category: input.categories.join(" > ") || undefined,
    inLanguage: input.locale,
    brand: { "@type": "Brand", name: "ROCO" },
    manufacturer: { "@id": ORGANIZATION_ID },
    additionalProperty: properties,
  });
}

export function buildContactPage(input: { name: string; path: string; description: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path),
    about: { "@id": ORGANIZATION_ID },
  };
}

export function buildAboutPage(input: { name: string; path: string; description: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path),
    mainEntity: { "@id": ORGANIZATION_ID },
  };
}
