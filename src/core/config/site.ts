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
} as const;
