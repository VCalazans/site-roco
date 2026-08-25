/**
 * External destinations and asset paths used across the site.
 *
 * Controlled via environment variables (NEXT_PUBLIC_* are inlined at build
 * time, so they must be present when `next build` runs). Fallbacks keep the
 * buttons working even when a var is not set in a given environment.
 */
export const siteLinks = {
  /** "Conheça nossos Produtos" — empty until the products URL is defined. */
  products: process.env.NEXT_PUBLIC_PRODUCTS_URL || "",
  /**
   * "Baixar Catálogo" — when empty the CTA points at this site's own catalog
   * page (`/{locale}/catalogo`), which gates the PDF behind the Mautic form.
   * Set it only to send visitors somewhere else instead (it bypasses the gate).
   */
  catalog: process.env.NEXT_PUBLIC_CATALOG_URL || "",
  /** The catalog PDF itself, served from /public (must stay same-origin so the
   *  browser honours the `download` attribute on the catalog page). */
  catalogPdf:
    process.env.NEXT_PUBLIC_CATALOG_PDF_URL ||
    "/downloads/catalogo-roco-2026.pdf",
  /** Privacy policy — shown next to the LGPD notice when defined. */
  privacy: process.env.NEXT_PUBLIC_PRIVACY_URL || "",
  /**
   * WhatsApp de contato (somente dígitos, com DDI). Usado pelo botão flutuante.
   * Padrão: (47) 3335-2012 → 55 (Brasil) + 47 (DDD) + número.
   */
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "554733352012",
} as const;

/** Route segment of the catalog page, appended after the locale prefix. */
export const CATALOG_SEGMENT = "catalogo";

/** Route segment of the representative pre-registration page. */
export const REPRESENTATIVES_SEGMENT = "representantes";

/** Route segment of the product catalog listing/detail pages. */
export const PRODUCTS_SEGMENT = "produtos";

/** Route segment of the public contact page. */
export const CONTACT_SEGMENT = "contato";

/** Locale-prefixed path of the representative pre-registration page. */
export function representativesPath(locale: string): string {
  return `/${locale}/${REPRESENTATIVES_SEGMENT}`;
}

/** Locale-prefixed path of the product catalog listing page. */
export function productsPath(locale: string): string {
  return `/${locale}/${PRODUCTS_SEGMENT}`;
}

/** Locale-prefixed path of the public contact page. */
export function contactPath(locale: string): string {
  return `/${locale}/${CONTACT_SEGMENT}`;
}

/** Filename suggested to the browser when the catalog PDF is downloaded. */
export const CATALOG_PDF_FILENAME = "catalogo-roco-2026.pdf";

/** Locale-prefixed path of the catalog page (`/pt/catalogo`). */
export function catalogPath(locale: string): string {
  return `/${locale}/${CATALOG_SEGMENT}`;
}

/**
 * Resolve a dictionary href to its real destination. Copy in the dictionaries
 * uses stable placeholder anchors (`#produtos`, `#catalogo`, `#representantes`,
 * `#contato`) — here we swap them for the configured URLs, falling back to the
 * internal page while a destination is still undefined. Some dictionary
 * entries (home CTAs, footer columns) already write the literal locale-less
 * path (`/produtos`, `/representantes`) instead of the anchor placeholder;
 * both spellings are treated as aliases of the same destination so copy can
 * use either without producing a broken (non locale-prefixed) link. Bare
 * routes (`/`) pass through untouched.
 */
export function resolveDestination(href: string, locale: string): string {
  switch (href) {
    case "#produtos":
    case "/produtos":
      return siteLinks.products || productsPath(locale);
    case "#catalogo":
      return siteLinks.catalog || catalogPath(locale);
    case "#representantes":
    case "/representantes":
      return representativesPath(locale);
    case "#contato":
      return contactPath(locale);
    default:
      return href;
  }
}
