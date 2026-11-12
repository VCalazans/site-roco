/**
 * Meta Pixel + API de Conversões (CAPI) — peças PURAS, sem I/O de servidor,
 * usadas pelo navegador (Pixel) e pelo servidor (`src/server/lib/meta-capi.ts`).
 *
 * Divisão de trabalho (decisionLog 2026-11-11):
 * - Lead e Contact saem DOS DOIS lados com o MESMO `event_id` (o
 *   `client_tracking_id` do lead, devolvido por `POST /api/contact`), e a Meta
 *   deduplica. O servidor manda e-mail/telefone em hash; o navegador manda o
 *   evento com os cookies `_fbp`/`_fbc`.
 * - PageView, ViewContent, Search, AddToCart, CompleteRegistration e o clique
 *   em "Continuar no WhatsApp" saem só do navegador.
 * - Venda (Purchase) é do RD Station, pela integração nativa — nunca daqui.
 *
 * Sem `NEXT_PUBLIC_META_PIXEL_ID` nada é carregado e `trackMeta` não faz nada.
 */

/** Assuntos de `POST /api/contact` (mesmo enum do schema). */
export type LeadSubject = "call_back" | "quote" | "general" | "catalog" | "cart";

export type MetaLeadEvent = {
  /** Evento padrão da Meta. */
  eventName: "Lead" | "Contact";
  /** `content_name`: identifica o formulário nos relatórios da Meta. */
  contentName: string;
};

/**
 * Pedido de orçamento e download do catálogo são LEAD (intenção comercial);
 * "Ligamos pra você" e "Fale conosco" são CONTACT. Os nomes seguem os de
 * `RD_LEAD_SOURCES`, para os dois painéis falarem a mesma língua.
 */
export const META_LEAD_EVENTS: Record<LeadSubject, MetaLeadEvent> = {
  call_back: { eventName: "Contact", contentName: "site-contato-ligamos-pra-voce" },
  general: { eventName: "Contact", contentName: "site-contato-fale-conosco" },
  quote: { eventName: "Lead", contentName: "site-contato-solicite-um-orcamento" },
  catalog: { eventName: "Lead", contentName: "catalogo-roco" },
  cart: { eventName: "Lead", contentName: "site-orcamento-lista-de-produtos" },
};

/** Evento personalizado do botão "Continuar no WhatsApp" (só navegador). */
export const META_WHATSAPP_EVENT = "ContinuarNoWhatsApp";

/** Cookie do clique no anúncio (formato da Meta: `fb.1.<ms>.<fbclid>`). */
export const META_FBC_COOKIE = "_fbc";
/** Cookie do navegador que o próprio Pixel grava. */
export const META_FBP_COOKIE = "_fbp";
/** 90 dias, a janela de atribuição de clique da Meta. */
export const META_FBC_MAX_AGE = 60 * 60 * 24 * 90;

const FBCLID_PATTERN = /^[A-Za-z0-9_-]{1,500}$/;

/** `fbclid` válido da URL ou `undefined` (valor estranho nunca vira cookie). */
export function normalizeFbclid(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && FBCLID_PATTERN.test(trimmed) ? trimmed : undefined;
}

/** Monta o `_fbc` no formato da Meta. */
export function buildFbc(fbclid: string, nowMs: number = Date.now()): string {
  return `fb.1.${nowMs}.${fbclid}`;
}

/** Último segmento do `_fbc` (o `fbclid`), para não regravar o mesmo clique. */
export function fbclidFromFbc(fbc: string | undefined): string | undefined {
  if (!fbc) return undefined;
  const parts = fbc.split(".");
  return parts.length >= 4 ? parts.slice(3).join(".") : undefined;
}

/** `_fbc`/`_fbp` no formato `fb.<n>.<n>.<valor>`; qualquer outra coisa é descartada. */
const FB_COOKIE_PATTERN = /^fb\.\d\.\d{10,16}\.[A-Za-z0-9_.-]{1,500}$/;

export function sanitizeFbCookie(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && FB_COOKIE_PATTERN.test(trimmed) ? trimmed : undefined;
}

/** ID do pixel no bundle (build-time). Só dígitos; qualquer outra coisa desliga. */
export function metaPixelId(): string | undefined {
  const id = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim();
  return id && /^\d{5,20}$/.test(id) ? id : undefined;
}

type FbqParams = Record<string, unknown>;
type Fbq = (
  command: "track" | "trackCustom",
  event: string,
  params?: FbqParams,
  options?: { eventID: string }
) => void;

function getFbq(): Fbq | undefined {
  if (typeof window === "undefined") return undefined;
  const fbq = (window as unknown as { fbq?: Fbq }).fbq;
  return typeof fbq === "function" ? fbq : undefined;
}

/**
 * Dispara um evento no Pixel. Sem o Pixel carregado (sem ID, bloqueador de
 * anúncio, desenvolvimento) não faz nada e nunca lança: rastreamento não pode
 * quebrar formulário.
 */
export function trackMeta(event: string, params?: FbqParams, eventId?: string, custom = false): void {
  try {
    const fbq = getFbq();
    if (!fbq) return;
    fbq(custom ? "trackCustom" : "track", event, params, eventId ? { eventID: eventId } : undefined);
  } catch {
    // Rastreamento é melhor esforço.
  }
}

/** Lead/Contact depois do 201 de `POST /api/contact`, com o `event_id` do servidor. */
export function trackMetaLead(subject: LeadSubject, eventId: string | undefined, params?: FbqParams): void {
  if (!eventId) return; // sem id não há deduplicação: o servidor já conta.
  const { eventName, contentName } = META_LEAD_EVENTS[subject];
  trackMeta(eventName, { content_name: contentName, ...params }, eventId);
}

/** Lê o `eventId` da resposta 201 sem lançar. */
export async function readLeadEventId(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.clone().json()) as { eventId?: unknown };
    return typeof body.eventId === "string" ? body.eventId : undefined;
  } catch {
    return undefined;
  }
}
