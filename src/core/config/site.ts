/**
 * External destinations for the landing CTAs.
 *
 * Controlled via environment variables (NEXT_PUBLIC_* are inlined at build
 * time, so they must be present when `next build` runs). Fallbacks keep the
 * buttons working even when a var is not set in a given environment.
 */
export const siteLinks = {
  /** "Conheça nossos Produtos" — empty until the products URL is defined. */
  products: process.env.NEXT_PUBLIC_PRODUCTS_URL || "",
  /** "Baixar Catálogo" — defaults to the known ROCO catalog. */
  catalog:
    process.env.NEXT_PUBLIC_CATALOG_URL ||
    "https://catalogo.roco.com.br/catalogo-roco",
  /**
   * WhatsApp de contato (somente dígitos, com DDI). Usado pelo botão flutuante.
   * Padrão: (47) 3335-2012 → 55 (Brasil) + 47 (DDD) + número.
   */
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "554733352012",
} as const;

/**
 * Resolve a dictionary href to its real destination. Copy in the dictionaries
 * uses stable placeholder anchors (`#produtos`, `#catalogo`); here we swap them
 * for the configured external URLs, keeping the anchor as a harmless fallback
 * until a URL is defined. In-page anchors (`#contato`) and routes (`/`) pass
 * through untouched so the contact modal and internal links keep working.
 */
export function resolveDestination(href: string): string {
  switch (href) {
    case "#produtos":
      return siteLinks.products || href;
    case "#catalogo":
      return siteLinks.catalog || href;
    default:
      return href;
  }
}
