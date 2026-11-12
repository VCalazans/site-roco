import "server-only";
import { createHash } from "node:crypto";
import { META_LEAD_EVENTS, sanitizeFbCookie, type LeadSubject } from "@/shared/lib/meta-pixel";

/**
 * API de Conversões da Meta — montagem PURA do evento (sem rede). O envio fica
 * em `meta-capi-send.ts`. Dados pessoais só vão em SHA-256, normalizados como
 * a Meta pede (minúsculas, sem espaços; telefone só dígitos com DDI).
 * Referência: developers.facebook.com/docs/marketing-api/conversions-api/parameters
 */

export type MetaCapiEvent = {
  event_name: string;
  event_time: number;
  event_id: string;
  action_source: "website";
  event_source_url?: string;
  user_data: Record<string, string | string[]>;
  custom_data: Record<string, unknown>;
};

export type MetaCapiLeadInput = {
  subject: LeadSubject;
  name: string;
  email: string;
  phone: string;
  /** `client_tracking_id` do lead: o MESMO `eventID` que o navegador usa. */
  eventId: string;
  ip?: string;
  userAgent?: string | null;
  fbp?: string;
  fbc?: string;
  /** Página do formulário (Referer da requisição). */
  sourceUrl?: string | null;
  productSku?: string;
  cartItems?: Array<{ sku: string; quantity: number }>;
  nowMs?: number;
};

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Só dígitos, com o DDI 55 quando vier no formato nacional (DDD + número). */
export function normalizePhone(phone: string): string | undefined {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.length >= 12 && digits.length <= 15) return digits;
  return undefined;
}

/** Primeiro e último nome, minúsculos e sem acento (como a Meta normaliza). */
export function splitName(name: string): { first?: string; last?: string } {
  const parts = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return {};
  return { first: parts[0], last: parts.length > 1 ? parts[parts.length - 1] : undefined };
}

/** Só http(s), sem fragmento, até 1000 caracteres. */
export function sanitizeSourceUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    url.hash = "";
    return url.toString().slice(0, 1000);
  } catch {
    return undefined;
  }
}

export function buildMetaLeadEvent(input: MetaCapiLeadInput): MetaCapiEvent {
  const { eventName, contentName } = META_LEAD_EVENTS[input.subject];
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  const { first, last } = splitName(input.name);

  const userData: Record<string, string | string[]> = {
    em: [sha256(email)],
    external_id: [sha256(email)],
    country: [sha256("br")],
  };
  if (phone) userData.ph = [sha256(phone)];
  if (first) userData.fn = [sha256(first)];
  if (last) userData.ln = [sha256(last)];
  if (input.ip && input.ip !== "unknown") userData.client_ip_address = input.ip;
  if (input.userAgent) userData.client_user_agent = input.userAgent.slice(0, 500);
  const fbp = sanitizeFbCookie(input.fbp);
  const fbc = sanitizeFbCookie(input.fbc);
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;

  const customData: Record<string, unknown> = { content_name: contentName };
  if (input.cartItems && input.cartItems.length > 0) {
    customData.content_type = "product";
    customData.content_ids = input.cartItems.map((item) => item.sku);
    customData.contents = input.cartItems.map((item) => ({ id: item.sku, quantity: item.quantity }));
    customData.num_items = input.cartItems.reduce((sum, item) => sum + item.quantity, 0);
  } else if (input.productSku) {
    customData.content_type = "product";
    customData.content_ids = [input.productSku];
  }

  const event: MetaCapiEvent = {
    event_name: eventName,
    event_time: Math.floor((input.nowMs ?? Date.now()) / 1000),
    event_id: input.eventId,
    action_source: "website",
    user_data: userData,
    custom_data: customData,
  };
  const sourceUrl = sanitizeSourceUrl(input.sourceUrl);
  if (sourceUrl) event.event_source_url = sourceUrl;
  return event;
}
