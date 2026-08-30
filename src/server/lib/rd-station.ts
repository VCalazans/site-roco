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
};

/** Prefixo dos campos CUSTOMIZADOS — os que precisam existir no painel do RD. */
export const RD_CUSTOM_FIELD_PREFIX = "cf_";

/**
 * Um `conversion_identifier` por INTENÇÃO DE NEGÓCIO. É string livre na API
 * (diferente dos `cf_*`, não exige cadastro prévio no painel), então separar
 * as quatro custa nada e o funil do RD passa a distinguir pedido de
 * orçamento, download de catálogo, pedido de ligação e contato geral — que
 * antes colapsavam em dois identificadores.
 */
const CONVERSION_IDENTIFIERS: Record<ContactInput["subject"], string> = {
  quote: "orcamento_produto",
  catalog: "download_catalogo",
  call_back: "ligamos_pra_voce",
  general: "contato_geral",
};

type RdStationLegalBase = { category: string; type: string; status: string };

/**
 * Campos do payload. Os `cf_*` são CUSTOMIZADOS e precisam existir na conta
 * do RD Station antes do primeiro envio (`cf_cnpj`, `cf_produto_interesse`,
 * `cf_origem` — ver `.env.example`); os demais são PADRÃO da Conversions API
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
