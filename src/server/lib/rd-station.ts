/**
 * Payload da Conversions API do RD Station para o formulário de contato
 * público (`POST /api/contact`). Ver decisionLog 2026-08-23 — substituto do
 * Mautic como plataforma de marketing.
 *
 * PURO e sem I/O de propósito (sem `server-only`, sem `fetch`): testável no
 * Vitest sem mocks de rede. O envio de verdade vive em `rd-station-send.ts`
 * (esse sim `server-only`), que importa o tipo do payload construído aqui.
 */
import type { ContactInput } from "./contact-submit";

export type RdStationConversionMeta = {
  /**
   * Mesmo UUID gravado em `contact_submissions.client_tracking_id` — a API
   * de conversões do RD Station não é idempotente (reenviar o mesmo evento
   * cria um novo evento), então este ID serve só para correlação/debug no
   * nosso lado, não para dedupe no lado do RD.
   */
  clientTrackingId: string;
  /** Nome do produto, já RESOLVIDO no servidor — nunca aceito cru do body. */
  productName?: string;
  productSku?: string;
  /**
   * Itens do carrinho de cotação (`subject === "cart"`) — nome/SKU já
   * RESOLVIDOS no servidor a partir dos slugs enviados, `quantity` é a
   * única informação que vem direto do cliente. Ausente/vazio para os
   * demais assuntos, que continuam usando só `productName`/`productSku`.
   */
  cartItems?: { name: string; sku: string; quantity: number }[];
};

/** Prefixo dos campos CUSTOMIZADOS — os que precisam existir no painel do RD. */
export const RD_CUSTOM_FIELD_PREFIX = "cf_";

/**
 * Um `conversion_identifier` por INTENÇÃO DE NEGÓCIO. É string livre na API
 * (diferente dos `cf_*`, não exige cadastro prévio no painel), então separar
 * as cinco custa nada e o funil do RD passa a distinguir pedido de
 * orçamento, download de catálogo, pedido de ligação, contato geral e
 * carrinho de cotação — que antes colapsavam em dois identificadores.
 */
const CONVERSION_IDENTIFIERS: Record<ContactInput["subject"], string> = {
  quote: "orcamento_produto",
  catalog: "download_catalogo",
  call_back: "ligamos_pra_voce",
  general: "contato_geral",
  cart: "carrinho_cotacao",
};

/**
 * Teto de tamanho de `cf_produtos_carrinho` — o mesmo problema de URL/limite
 * que motivou truncar UTMs em `lead-origin.ts`, aqui para o campo do RD:
 * um carrinho com 20 itens de nome longo poderia produzir uma string bem
 * maior que o razoável para um campo customizado. Quando trunca, um sufixo
 * deixa claro que a lista completa está no e-mail de notificação (que NÃO
 * tem este teto — ver `contact-email.ts`).
 */
export const CART_SUMMARY_MAX_LENGTH = 1000;
const CART_SUMMARY_TRUNCATION_SUFFIX = "; (+ lista completa por e-mail)";

/**
 * Monta o resumo textual dos itens do carrinho para `cf_produtos_carrinho`.
 * PURA, sem I/O — testável isoladamente.
 *
 * Formato por item: `"SKU {sku} - {nome} (x{qtd})"`, itens separados por
 * `"; "`. Trunca em `max` caracteres cortando no limite de um item inteiro
 * (nunca no meio de um nome) antes de acrescentar o sufixo de aviso.
 */
export function buildCartProductsSummary(
  items: { name: string; sku: string; quantity: number }[],
  max: number = CART_SUMMARY_MAX_LENGTH
): string {
  const parts = items.map((item) => `SKU ${item.sku} - ${item.name} (x${item.quantity})`);
  const full = parts.join("; ");
  if (full.length <= max) return full;

  const budget = Math.max(0, max - CART_SUMMARY_TRUNCATION_SUFFIX.length);
  let result = "";
  for (const part of parts) {
    const candidate = result ? `${result}; ${part}` : part;
    if (candidate.length > budget) break;
    result = candidate;
  }
  return `${result}${CART_SUMMARY_TRUNCATION_SUFFIX}`;
}

/**
 * Teto de `cf_mensagem`. A mensagem livre aceita até 2000 caracteres no nosso
 * schema (`contact-submit.ts`), mas o campo do RD é um campo de texto de CRM,
 * não um corpo de e-mail — mesmo raciocínio de `CART_SUMMARY_MAX_LENGTH`.
 * O texto íntegro continua em `contact_submissions.message` e no e-mail de
 * notificação, que não têm este teto.
 */
export const MESSAGE_MAX_LENGTH = 1000;
const MESSAGE_TRUNCATION_SUFFIX = "… (mensagem completa por e-mail)";

/**
 * Prepara a mensagem livre para `cf_mensagem`. PURA, sem I/O.
 *
 * Colapsa quebras de linha e espaços repetidos num único espaço: o campo
 * customizado do RD é exibido em UMA linha na ficha do contato, e o
 * `<textarea>` do formulário produz quebras com frequência (ver
 * `optionalMultilineField`, que passou a aceitá-las de propósito em
 * 2026-08-25). Trunca no limite de PALAVRA, nunca no meio dela.
 */
export function buildMessageSummary(
  message: string,
  max: number = MESSAGE_MAX_LENGTH
): string {
  const flat = message.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;

  const budget = Math.max(0, max - MESSAGE_TRUNCATION_SUFFIX.length);
  const clipped = flat.slice(0, budget);
  const lastSpace = clipped.lastIndexOf(" ");
  const body = lastSpace > 0 ? clipped.slice(0, lastSpace) : clipped;
  return `${body}${MESSAGE_TRUNCATION_SUFFIX}`;
}

type RdStationLegalBase = { category: string; type: string; status: string };

/**
 * Campos do payload. Os `cf_*` são CUSTOMIZADOS e precisam existir na conta
 * do RD Station antes do primeiro envio (`cf_cnpj`, `cf_produto_interesse`,
 * `cf_origem`, `cf_produtos_carrinho`, `cf_mensagem` — ver `.env.example`); os demais são
 * PADRÃO da Conversions API
 * e funcionam sem nenhuma configuração no painel — inclusive
 * `traffic_source`/`traffic_medium`/`traffic_campaign`, que são os slots
 * nativos de UTM.
 */
export type RdStationConversionFields = {
  conversion_identifier: string;
  name: string;
  email: string;
  personal_phone: string;
  company_name?: string;
  cf_cnpj?: string;
  cf_produto_interesse?: string;
  cf_origem?: string;
  cf_produtos_carrinho?: string;
  cf_mensagem?: string;
  traffic_source?: string;
  traffic_medium?: string;
  traffic_campaign?: string;
  client_tracking_id: string;
  legal_bases: RdStationLegalBase[];
};

export type RdStationConversionPayload = {
  event_type: "CONVERSION";
  event_family: "CDP";
  payload: RdStationConversionFields;
};

/**
 * Monta o payload da Conversions API.
 *
 * Duas dimensões de rastreio, COMPLEMENTARES (nunca se sobrescrevem):
 *  - ORIGEM (seção interna do site) → campo CUSTOMIZADO `cf_origem`.
 *    Deliberadamente NÃO usa `traffic_source`: aquele é território de UTM e
 *    colidiria com uma campanha paga de verdade.
 *  - CAMPANHA externa (UTM) → campos PADRÃO `traffic_source`/
 *    `traffic_medium`/`traffic_campaign`.
 */
export function buildRdStationConversionPayload(
  input: ContactInput,
  meta: RdStationConversionMeta
): RdStationConversionPayload {
  const conversionIdentifier = CONVERSION_IDENTIFIERS[input.subject];
  const cfProdutoInteresse = meta.productName
    ? meta.productSku
      ? `${meta.productName} — SKU ${meta.productSku}`
      : meta.productName
    : undefined;
  const cfProdutosCarrinho =
    meta.cartItems && meta.cartItems.length > 0
      ? buildCartProductsSummary(meta.cartItems)
      : undefined;
  const cfMensagem = input.message ? buildMessageSummary(input.message) : undefined;

  return {
    event_type: "CONVERSION",
    event_family: "CDP",
    payload: {
      conversion_identifier: conversionIdentifier,
      name: input.name,
      email: input.email,
      personal_phone: input.phone,
      ...(input.companyName ? { company_name: input.companyName } : {}),
      ...(input.cnpj ? { cf_cnpj: input.cnpj } : {}),
      ...(cfProdutoInteresse ? { cf_produto_interesse: cfProdutoInteresse } : {}),
      ...(cfProdutosCarrinho ? { cf_produtos_carrinho: cfProdutosCarrinho } : {}),
      ...(cfMensagem ? { cf_mensagem: cfMensagem } : {}),
      ...(input.origin ? { cf_origem: input.origin } : {}),
      ...(input.utmSource ? { traffic_source: input.utmSource } : {}),
      ...(input.utmMedium ? { traffic_medium: input.utmMedium } : {}),
      ...(input.utmCampaign ? { traffic_campaign: input.utmCampaign } : {}),
      client_tracking_id: meta.clientTrackingId,
      legal_bases: [
        {
          category: "communications",
          type: "consent",
          // `granted` / `declined` são os únicos valores do enum documentado.
          // O caminho `declined` é inalcançável hoje (`consent: z.literal(true)`
          // no schema), mas mandar um status FORA do enum arriscaria um 400 —
          // e um 400 derruba a conversão inteira, não só o campo.
          status: input.consent ? "granted" : "declined",
        },
      ],
    },
  };
}

/**
 * Cópia do payload SEM nenhum campo customizado (`cf_*`) — o fallback do
 * retry gracioso em `rd-station-send.ts`. Nome, e-mail e telefone valem mais
 * que os campos extras: se o painel do RD ainda não tem `cf_origem`
 * cadastrado, é melhor perder a origem do que perder o lead inteiro.
 */
export function stripCustomFields(
  payload: RdStationConversionPayload
): RdStationConversionPayload {
  const fields: Record<string, unknown> = { ...payload.payload };
  for (const key of Object.keys(fields)) {
    if (key.startsWith(RD_CUSTOM_FIELD_PREFIX)) {
      delete fields[key];
    }
  }
  return { ...payload, payload: fields as RdStationConversionFields };
}

/** Se o payload ainda carrega algum campo customizado (vale tentar o retry). */
export function hasCustomFields(payload: RdStationConversionPayload): boolean {
  return Object.keys(payload.payload).some((key) => key.startsWith(RD_CUSTOM_FIELD_PREFIX));
}

export type RdStationValidationErrorKind = "custom_field" | "other" | "unknown";

/**
 * Classifica o corpo de um 400 da Conversions API.
 *
 * ⚠️ DEFESA PREVENTIVA, não comportamento documentado: a doc do RD confirma
 * que campo customizado precisa EXISTIR na conta e que o erro padrão para
 * atributo inexistente é `INVALID_FIELDS` ("Payload contains fields that do
 * not exist"), mas NÃO afirma explicitamente que um `cf_` inexistente
 * rejeita a conversão inteira. Tratamos como se rejeitasse, porque o custo
 * de errar para o lado seguro é uma requisição extra e o custo de errar para
 * o outro lado é perder TODOS os leads até alguém notar.
 *
 * O corpo aparece em DUAS formas na documentação oficial — `errors` como
 * array (referência do endpoint de conversão) e como objeto (página de
 * mensagens de erro) — então normalizamos antes de procurar.
 *
 * Retorna `"unknown"` quando não dá para classificar: o caller trata isso
 * como motivo suficiente para tentar o retry (pior caso, um segundo 400 com
 * o lead já gravado no banco).
 */
export function classifyRdStationValidationError(body: unknown): RdStationValidationErrorKind {
  const entries = normalizeErrorEntries(body);
  if (entries.length === 0) return "unknown";

  let recognized = false;
  for (const entry of entries) {
    const errorType = readString(entry, "error_type");
    const errorMessage = readString(entry, "error_message");
    const path = readString(entry, "path");
    if (errorType || errorMessage || path) recognized = true;

    if (errorType?.toUpperCase() === "INVALID_FIELDS") return "custom_field";
    if (path?.startsWith(RD_CUSTOM_FIELD_PREFIX)) return "custom_field";
    if (errorMessage?.includes(RD_CUSTOM_FIELD_PREFIX)) return "custom_field";
    if (errorMessage?.toLowerCase().includes("do not exist")) return "custom_field";
  }

  return recognized ? "other" : "unknown";
}

function normalizeErrorEntries(body: unknown): unknown[] {
  if (!isRecord(body)) return [];
  const errors = body.errors;
  if (Array.isArray(errors)) return errors;
  if (isRecord(errors)) return [errors];
  // Alguns retornos trazem o erro solto na raiz do corpo.
  if (typeof body.error_type === "string" || typeof body.error_message === "string") {
    return [body];
  }
  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) return undefined;
  const found = value[key];
  return typeof found === "string" ? found : undefined;
}
