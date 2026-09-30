import { productsPath } from "@/core/config/site";

/**
 * Links de um produto para quem opera o portal e para o representante que
 * compartilha o item com um cliente (spec 001, RF31). Puro para ser testável;
 * a mensagem do WhatsApp é montada pelo chamador com o texto do dicionário
 * (`portal.products.share.message`).
 */

/** Caminho público do produto no site: `/{locale}/produtos/{slug}`. */
export function productPublicPath(locale: string, slug: string): string {
  // Slugs saem de `slugify` (ASCII), mas o slug também é editável no banco —
  // codificar evita que um caractere estranho quebre o link ou injete `?`/`#`.
  return `${productsPath(locale)}/${encodeURIComponent(slug)}`;
}

/** URL absoluta (para copiar/compartilhar fora do site). */
export function productPublicUrl(origin: string, locale: string, slug: string): string {
  return new URL(productPublicPath(locale, slug), origin).toString();
}

/**
 * Link de compartilhamento do WhatsApp sem destinatário: o próprio WhatsApp
 * abre o seletor de conversa com a mensagem pronta (`wa.me/?text=`).
 */
export function buildWhatsappShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
