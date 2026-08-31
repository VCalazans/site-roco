/**
 * Monta a URL `https://wa.me/{numero}?text=...` do botão secundário de
 * WhatsApp do carrinho de cotação. Função PURA de propósito (sem importar
 * `@/core/config/site`): quem chama passa o número já resolvido
 * (`siteLinks.whatsapp`), o que mantém este módulo testável sem depender de
 * env vars.
 *
 * Ação INDEPENDENTE do envio por `POST /api/contact` — a pessoa pode clicar
 * os dois, só um, ou nenhum; nada aqui lê ou muta o carrinho.
 */

export type CartWhatsappItem = { name: string; sku: string; quantity: number };

/**
 * Teto de tamanho da URL final (já codificada). `wa.me` não documenta um
 * limite duro, mas navegadores/apps têm tetos práticos de URL bem abaixo de
 * 8k; 1900 é uma margem seguramente confortável para uma lista de produtos.
 */
export const WA_ME_MAX_URL_LENGTH = 1900;

function formatItemLine(item: CartWhatsappItem): string {
  return `- ${item.name} (SKU ${item.sku}) x${item.quantity}`;
}

function buildText(items: CartWhatsappItem[], includedCount: number, intro: string, moreItemsSuffixTemplate: string): string {
  const lines = items.slice(0, includedCount).map(formatItemLine);
  const removedCount = items.length - includedCount;
  const suffix = removedCount > 0 ? moreItemsSuffixTemplate.replace("{count}", String(removedCount)) : null;

  return [intro, ...lines, suffix].filter((line): line is string => Boolean(line)).join("\n");
}

function encodedUrl(whatsappNumber: string, text: string): string {
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`;
}

/**
 * Monta a mensagem com `intro` + uma linha por item
 * (`"- {nome} (SKU {sku}) x{qtd}"`), removendo itens do FIM até a URL
 * codificada caber em `WA_ME_MAX_URL_LENGTH`. Quando algum item é removido,
 * acrescenta uma linha final a partir de `moreItemsSuffixTemplate` (que
 * contém o literal `{count}`, substituído pela quantidade de itens
 * removidos).
 */
export function buildWhatsappCartMessage(
  items: CartWhatsappItem[],
  intro: string,
  moreItemsSuffixTemplate: string,
  whatsappNumber: string
): string {
  for (let included = items.length; included >= 0; included -= 1) {
    const text = buildText(items, included, intro, moreItemsSuffixTemplate);
    if (included === 0 || encodedUrl(whatsappNumber, text).length <= WA_ME_MAX_URL_LENGTH) {
      return encodedUrl(whatsappNumber, text);
    }
  }

  // Inalcançável (o loop sempre retorna em `included === 0`) — só satisfaz o
  // compilador quanto a um retorno em todo caminho.
  return encodedUrl(whatsappNumber, intro);
}
