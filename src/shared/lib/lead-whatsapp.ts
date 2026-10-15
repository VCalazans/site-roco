/**
 * Mensagem de WhatsApp montada a partir do que a pessoa preencheu num
 * formulário do site (contato, catálogo, orçamento). Depois do envio por
 * `POST /api/contact`, o formulário abre `wa.me` com esta mensagem pronta —
 * quem envia é a própria pessoa, pelo WhatsApp dela.
 *
 * PURA, sem I/O e sem `@/core/config/site`: quem chama passa o número e os
 * textos do dicionário (`leadWhatsapp`), o que mantém o módulo testável.
 */
import { interpolate } from "@/shared/lib/interpolate";

/** Mesmo teto da URL do botão de WhatsApp do orçamento (`cart-whatsapp.ts`). */
export const LEAD_WA_MAX_URL_LENGTH = 1900;

export type LeadWhatsappSubject = "call_back" | "quote" | "general" | "catalog" | "cart";

/** Textos do dicionário (`leadWhatsapp`). */
export type LeadWhatsappDictionary = {
  intro: Record<LeadWhatsappSubject, string>;
  labels: {
    name: string;
    company: string;
    cnpj: string;
    phone: string;
    email: string;
    product: string;
    message: string;
    items: string;
  };
  /** Com `{count}`: itens que não couberam na URL. */
  moreItems: string;
  /** Sufixo da mensagem livre cortada para caber na URL. */
  truncated: string;
  button: string;
  opened: string;
};

export type LeadWhatsappData = {
  subject: LeadWhatsappSubject;
  name: string;
  companyName?: string;
  cnpj: string;
  phone: string;
  email: string;
  /** Nome do produto (pedido de orçamento de um produto). */
  product?: string;
  message?: string;
  items?: { name: string; sku: string; quantity: number }[];
};

function waUrl(number: string, text: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

function buildText(
  data: LeadWhatsappData,
  content: LeadWhatsappDictionary,
  includedItems: number,
  message: string | undefined
): string {
  const l = content.labels;
  const field = (label: string, value: string | undefined) =>
    value && value.trim() ? `*${label}:* ${value.trim()}` : null;

  const lines: (string | null)[] = [
    content.intro[data.subject],
    "",
    field(l.name, data.name),
    field(l.company, data.companyName),
    field(l.cnpj, data.cnpj),
    field(l.phone, data.phone),
    field(l.email, data.email),
    field(l.product, data.product),
  ];

  const items = data.items ?? [];
  if (items.length > 0) {
    lines.push(`*${l.items}:*`);
    for (const item of items.slice(0, includedItems)) {
      lines.push(`- ${item.name} (SKU ${item.sku}) x${item.quantity}`);
    }
    const removed = items.length - includedItems;
    if (removed > 0) lines.push(interpolate(content.moreItems, { count: removed }));
  }

  lines.push(field(l.message, message));

  return lines.filter((line): line is string => line !== null).join("\n");
}

/**
 * URL `wa.me` com a mensagem. Para caber em `LEAD_WA_MAX_URL_LENGTH`, corta
 * primeiro os itens do fim (com aviso de quantos ficaram de fora) e depois
 * encurta a mensagem livre — os dados de contato nunca saem.
 */
export function buildLeadWhatsappUrl(
  number: string,
  data: LeadWhatsappData,
  content: LeadWhatsappDictionary
): string {
  const fits = (text: string) => waUrl(number, text).length <= LEAD_WA_MAX_URL_LENGTH;
  const message = data.message?.replace(/\s+/g, " ").trim() || undefined;
  const itemCount = data.items?.length ?? 0;

  for (let included = itemCount; included >= 0; included -= 1) {
    const text = buildText(data, content, included, message);
    if (fits(text)) return waUrl(number, text);
  }

  if (message) {
    // Corta a mensagem por palavras até caber.
    const words = message.split(" ");
    while (words.length > 0) {
      words.pop();
      const clipped = words.length > 0 ? `${words.join(" ")}${content.truncated}` : undefined;
      const text = buildText(data, content, 0, clipped);
      if (fits(text)) return waUrl(number, text);
    }
  }

  return waUrl(number, buildText(data, content, 0, undefined));
}

/**
 * Abre o WhatsApp numa aba nova logo depois do envio. O navegador pode
 * bloquear a janela (a ativação do clique expira durante o `fetch`); por isso
 * a tela de sucesso sempre mostra também o botão com o mesmo link.
 */
export function openLeadWhatsapp(url: string): void {
  if (typeof window === "undefined") return;
  try {
    const opened = window.open(url, "_blank");
    if (opened) opened.opener = null;
  } catch {
    // Silencioso: o botão da tela de sucesso cobre o caso.
  }
}
