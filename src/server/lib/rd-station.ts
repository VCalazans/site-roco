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

/**
 * Monta o payload da Conversions API. `conversion_identifier` distingue os
 * dois eventos de negócio que o RD Station precisa reconhecer no funil:
 * pedido de orçamento (maior intenção comercial) vs contato geral/"ligamos
 * pra você". Os campos customizados `cf_cnpj`/`cf_produto_interesse`
 * precisam existir no painel do RD Station ANTES do primeiro envio (ver
 * `.env.example`).
 */
export function buildRdStationConversionPayload(
  input: ContactInput,
  meta: RdStationConversionMeta
) {
  const conversionIdentifier = input.subject === "quote" ? "orcamento_produto" : "contato_geral";
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
      client_tracking_id: meta.clientTrackingId,
      legal_bases: [
        {
          category: "communications",
          type: "consent",
          status: input.consent ? "granted" : "not_provided",
        },
      ],
    },
  };
}

export type RdStationConversionPayload = ReturnType<typeof buildRdStationConversionPayload>;
