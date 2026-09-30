/**
 * Funções PURAS da caixa de Solicitações (`/portal/solicitacoes`, spec 001,
 * RF29): links de resposta (e-mail/WhatsApp), resumo de itens, leitura do
 * estado dos canais de envio e formatação de data. Sem React e sem I/O —
 * testáveis no Vitest (`leads-helpers.test.ts`).
 */
import type { Locale } from "@/i18n/config";
import type { PortalLeadsDictionary } from "@/modules/portal/lib/leads-dictionary";
import type { ContactSubject } from "@/server/lib/contact-submit";
import { interpolate } from "@/shared/lib/interpolate";
import { LEAD_ORIGINS, type LeadOrigin } from "@/shared/lib/lead-origin";

/** Ordem das abas de filtro: do que mais interessa ao comercial para o que menos. */
export const SUBJECT_FILTER_ORDER = [
  "cart",
  "quote",
  "call_back",
  "general",
  "catalog",
] as const satisfies readonly ContactSubject[];

// ---------------------------------------------------------------------------
// Origem
// ---------------------------------------------------------------------------

/**
 * Valores GRAVADOS antes de a lista fechada mudar. `carrinho` era a origem da
 * lista de orçamento até a spec 001; linhas antigas continuam no banco e não
 * podem vazar a palavra antiga para a tela.
 */
const LEGACY_ORIGIN_ALIASES: Readonly<Record<string, LeadOrigin>> = { carrinho: "orcamento" };

/** Rótulo humano da origem, ou `null` quando não há origem (ou ela é desconhecida). */
export function originLabel(
  origin: string | null | undefined,
  labels: PortalLeadsDictionary["origins"]
): string | null {
  if (!origin) return null;
  const known = (LEAD_ORIGINS as readonly string[]).includes(origin)
    ? (origin as LeadOrigin)
    : LEGACY_ORIGIN_ALIASES[origin];
  return known ? labels[known] : null;
}

// ---------------------------------------------------------------------------
// Contato: WhatsApp e e-mail
// ---------------------------------------------------------------------------

/**
 * Número no formato do `wa.me` (DDI 55 + DDD + número). O formulário só aceita
 * telefone brasileiro (10 ou 11 dígitos), mas o valor gravado pode vir mascarado
 * — `(47) 99999-9999` — ou já com o 55. `null` = não dá para montar um número
 * confiável, e a UI esconde o botão em vez de abrir uma conversa errada.
 */
export function whatsappNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return digits;
  return null;
}

export function buildWhatsappUrl(phone: string, message?: string): string | null {
  const number = whatsappNumber(phone);
  if (!number) return null;
  return message ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : `https://wa.me/${number}`;
}

/**
 * `mailto:` só com o endereço. O `@` fica legível, mas todo o resto que não é
 * seguro numa URL (`?`, `&`, `=`, `,`, espaço…) é codificado: o e-mail vem de
 * um formulário público, e um endereço com `?bcc=…` não pode virar cabeçalho
 * extra (destinatário oculto) na mensagem que o operador vai enviar.
 */
export function mailtoHref(email: string): string {
  return `mailto:${encodeURIComponent(email).replace(/%40/g, "@")}`;
}

/**
 * `mailto:` com assunto e corpo. Quebras de linha viram CRLF (RFC 6068) — com
 * só LF, alguns clientes de e-mail colam o texto numa linha única.
 */
export function buildMailtoUrl(email: string, subject: string, body?: string): string {
  const params = [`subject=${encodeURIComponent(subject)}`];
  if (body) params.push(`body=${encodeURIComponent(body.replace(/\r?\n/g, "\r\n"))}`);
  return `${mailtoHref(email)}?${params.join("&")}`;
}

/**
 * Textos das respostas (assunto e saudação do e-mail, abertura do WhatsApp) em
 * CADA idioma do site. A resposta segue o idioma em que o visitante escreveu
 * (`contact_submissions.locale`), não o idioma do painel de quem responde —
 * senão um visitante do site em inglês receberia a saudação em português.
 */
export type LeadReplyTemplates = Record<
  Locale,
  {
    subjects: PortalLeadsDictionary["subjects"];
    replySubject: string;
    replyGreeting: string;
    whatsappGreeting: string;
  }
>;

export function pickReplyTemplate(leads: PortalLeadsDictionary): LeadReplyTemplates[Locale] {
  return {
    subjects: leads.subjects,
    replySubject: leads.detail.replySubject,
    replyGreeting: leads.detail.replyGreeting,
    whatsappGreeting: leads.detail.whatsappGreeting,
  };
}

/** Idioma da resposta: o do visitante (`en` ou, na dúvida, `pt` — o idioma principal do negócio). */
export function replyLocale(leadLocale: string): Locale {
  return leadLocale === "en" ? "en" : "pt";
}

/** Links e textos de resposta de uma solicitação, prontos para os botões do detalhe. */
export function buildReplyActions(
  lead: { name: string; email: string; phone: string; subject: ContactSubject; locale: string },
  templates: LeadReplyTemplates
): { mailtoUrl: string; whatsappUrl: string | null } {
  const template = templates[replyLocale(lead.locale)];
  const subject = interpolate(template.replySubject, { subject: template.subjects[lead.subject] });
  const body = interpolate(template.replyGreeting, { name: lead.name });
  return {
    mailtoUrl: buildMailtoUrl(lead.email, subject, body),
    whatsappUrl: buildWhatsappUrl(lead.phone, interpolate(template.whatsappGreeting, { name: lead.name })),
  };
}

// ---------------------------------------------------------------------------
// Itens da solicitação
// ---------------------------------------------------------------------------

function plural(count: number, one: string, other: string): string {
  return interpolate(count === 1 ? one : other, { count });
}

export type LeadItemsSummarySource = {
  productName: string | null;
  productSku: string | null;
  itemsCount: number;
  unitsCount: number;
};

/**
 * Coluna "Itens" da tabela: lista de orçamento → "3 produtos · 12 un.";
 * orçamento de produto único → nome (+ SKU); demais assuntos → `null`.
 */
export function summarizeLeadItems(
  lead: LeadItemsSummarySource,
  labels: PortalLeadsDictionary["items"]
): { primary: string; secondary: string | null } | null {
  if (lead.itemsCount > 0) {
    return {
      primary: interpolate(labels.listSummary, {
        products: plural(lead.itemsCount, labels.productsOne, labels.productsOther),
        units: plural(lead.unitsCount, labels.unitsOne, labels.unitsOther),
      }),
      secondary: null,
    };
  }
  if (lead.productName) {
    return {
      primary: lead.productName,
      secondary: lead.productSku ? interpolate(labels.sku, { sku: lead.productSku }) : null,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Canais de envio (RD Station, e-mail)
// ---------------------------------------------------------------------------

export type ChannelTone = "success" | "error" | "warning" | "neutral";
export type ChannelStatusKey = keyof PortalLeadsDictionary["channels"]["status"];

/** Códigos de erro que significam "falta configurar o serviço", não "o serviço falhou". */
const UNCONFIGURED_ERRORS: ReadonlySet<string> = new Set(["not_configured", "missing_api_key"]);

/**
 * Traduz o par (status, erro) gravado em `contact_submissions` para o que a UI
 * mostra. O backend registra "serviço sem credencial" como `failed` +
 * `not_configured`/`missing_api_key`; na TELA isso é uma pendência de
 * configuração (aviso), não um envio que deu errado (erro) — a distinção só
 * existe no detalhe, porque a lista não traz o texto do erro.
 */
export function describeChannel(
  status: string,
  error?: string | null
): { tone: ChannelTone; status: ChannelStatusKey } {
  switch (status) {
    case "sent":
      return { tone: "success", status: "sent" };
    case "failed":
      return error && UNCONFIGURED_ERRORS.has(error)
        ? { tone: "warning", status: "not_configured" }
        : { tone: "error", status: "failed" };
    case "pending":
      return { tone: "neutral", status: "pending" };
    case "not_configured":
      return { tone: "warning", status: "not_configured" };
    case "skipped":
      return { tone: "neutral", status: "skipped" };
    default:
      return { tone: "neutral", status: "unknown" };
  }
}

const HTTP_ERROR_PATTERN = /^http_(\d{3})$/;

/** Mensagem legível para o código de erro de um canal (`null` quando não há erro). */
export function channelErrorMessage(
  code: string | null | undefined,
  errors: PortalLeadsDictionary["detail"]["delivery"]["errors"]
): string | null {
  if (!code) return null;
  const http = HTTP_ERROR_PATTERN.exec(code);
  if (http) return interpolate(errors.http, { code: http[1] });
  switch (code) {
    case "not_configured":
    case "missing_api_key":
    case "validation":
    case "validation_retry_ok":
    case "validation_retry_failed":
    case "rate_limited":
    case "network":
      return errors[code];
    default:
      return interpolate(errors.unknown, { code });
  }
}

/** `leads.byId` responde NOT_FOUND quando a solicitação foi removida (ex.: expurgo de retenção). */
export function isNotFoundError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const data = (error as { data?: unknown }).data;
  return typeof data === "object" && data !== null && (data as { code?: unknown }).code === "NOT_FOUND";
}

// ---------------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------------

function intlLocale(locale: Locale): string {
  return locale === "en" ? "en-US" : "pt-BR";
}

function toDate(value: string | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "29/09/2026" (pt) / "9/29/26" (en) — no fuso do navegador de quem opera. */
export function formatDate(value: string | Date, locale: Locale): string {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "short" }).format(date) : "—";
}

export function formatTime(value: string | Date, locale: Locale): string {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat(intlLocale(locale), { timeStyle: "short" }).format(date) : "—";
}

export function formatDateTime(value: string | Date, locale: Locale): string {
  const date = toDate(value);
  return date
    ? new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "short", timeStyle: "short" }).format(date)
    : "—";
}
