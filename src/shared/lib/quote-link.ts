/**
 * Link de orçamento pronto (spec 003): a IA monta a lista pelo servidor MCP
 * (`montar_orcamento`) e devolve `/{locale}/orcamento?itens=slug:2,slug:1`. A
 * página abre com esses itens em "Meu orçamento"; a pessoa revisa, preenche os
 * dados e envia (Turnstile + consentimento continuam valendo). Nada é gravado
 * no servidor antes do envio.
 *
 * Puro: usado pelo servidor MCP (montar o link) e pela página (ler o link).
 */
import { MAX_CART_ITEMS, MAX_CART_ITEM_QUANTITY } from "@/server/lib/contact-submit";

export const QUOTE_ITEMS_PARAM = "itens";

export type QuoteLinkItem = { slug: string; quantity: number };

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function clampQuantity(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_CART_ITEM_QUANTITY, Math.max(1, Math.floor(value)));
}

/** `[{slug, quantity}]` → `slug:2,slug:1` (sem repetir slug; até `MAX_CART_ITEMS`). */
export function encodeQuoteItems(items: readonly QuoteLinkItem[]): string {
  return parseQuoteItems(items.map((item) => `${item.slug}:${item.quantity}`).join(","))
    .map((item) => `${item.slug}:${item.quantity}`)
    .join(",");
}

/**
 * Lê o parâmetro `itens`. Tolerante: entrada malformada é ignorada item a item
 * (slug fora do padrão, quantidade inválida vira 1); slug repetido soma.
 */
export function parseQuoteItems(raw: string | string[] | null | undefined): QuoteLinkItem[] {
  const value = Array.isArray(raw) ? raw.join(",") : raw ?? "";
  const bySlug = new Map<string, number>();
  for (const part of value.slice(0, 4000).split(",")) {
    const [rawSlug, rawQuantity] = part.trim().split(":");
    const slug = (rawSlug ?? "").trim().toLowerCase();
    if (!SLUG.test(slug) || slug.length > 200) continue;
    if (!bySlug.has(slug) && bySlug.size >= MAX_CART_ITEMS) continue;
    const quantity = clampQuantity(rawQuantity === undefined ? 1 : Number(rawQuantity));
    bySlug.set(slug, clampQuantity((bySlug.get(slug) ?? 0) + quantity));
  }
  return [...bySlug].map(([slug, quantity]) => ({ slug, quantity }));
}
