/**
 * E-mail de notificação interna do formulário de contato público
 * (`POST /api/contact`) — avisa o time comercial que um lead chegou. NÃO é
 * o e-mail visto pelo lead (não há e-mail transacional de confirmação
 * nesta primeira versão).
 *
 * PURO e sem I/O de propósito (sem `server-only`, sem `fetch`): testável no
 * Vitest sem mocks de rede. O envio de verdade vive em
 * `contact-email-send.ts` (esse sim `server-only`).
 */
import type { LeadOrigin } from "@/shared/lib/lead-origin";
import type { ContactInput } from "./contact-submit";

export type ContactEmailContent = { subject: string; text: string; html: string };

const SUBJECT_LABELS: Record<ContactInput["subject"], string> = {
  call_back: "Ligamos pra você",
  quote: "Solicitação de orçamento",
  general: "Contato geral",
  catalog: "Download do catálogo",
};

/**
 * Rótulo humano de cada seção do site que pode originar um lead. É um
 * `Record` TIPADO de propósito: acrescentar um valor em `LEAD_ORIGINS`
 * (`@/shared/lib/lead-origin`) sem dar rótulo aqui quebra o build, em vez de
 * chegar ao time comercial como um slug cru.
 *
 * Texto em pt-BR direto no código (não no dicionário i18n) porque este
 * e-mail é NOTIFICAÇÃO INTERNA — nunca é visto pelo visitante —, mesmo
 * critério já aplicado a `SUBJECT_LABELS` acima.
 */
const LEAD_ORIGIN_LABELS: Record<LeadOrigin, string> = {
  "home-hero": "Home — primeira dobra (hero)",
  "home-sobre": "Home — seção institucional",
  "home-categorias": "Home — vitrine de categorias",
  "home-destaques": "Home — produtos em destaque",
  "home-portal": "Home — chamada do Portal ROCO",
  "produtos-listagem": "Listagem de produtos",
  "produto-detalhe": "Detalhe de produto",
  catalogo: "Página do catálogo",
  menu: "Menu de navegação",
  rodape: "Rodapé",
};

/**
 * Monta o e-mail de notificação. Texto simples é suficiente em `html`
 * (`<pre>` com as quebras de linha do `text`) — sem template visual nesta
 * primeira versão; o objetivo é o time comercial ver os dados rapidamente,
 * não uma peça de e-mail marketing.
 */
export function buildContactNotificationEmail(
  input: ContactInput,
  meta: { productName?: string; productSku?: string }
): ContactEmailContent {
  const subjectLabel = SUBJECT_LABELS[input.subject];
  const subject = `[Site ROCO] Novo contato — ${subjectLabel} — ${input.name}`;

  const lines = [
    `Assunto: ${subjectLabel}`,
    `Nome: ${input.name}`,
    `E-mail: ${input.email}`,
    `Telefone: ${input.phone}`,
    input.companyName ? `Empresa: ${input.companyName}` : null,
    input.cnpj ? `CNPJ: ${input.cnpj}` : null,
    meta.productName
      ? `Produto de interesse: ${meta.productName}${meta.productSku ? ` (SKU ${meta.productSku})` : ""}`
      : null,
    // Origem = seção INTERNA do site; campanha = tráfego EXTERNO. As duas
    // linhas são independentes: um lead pode ter as duas, uma, ou nenhuma.
    input.origin ? `Origem no site: ${LEAD_ORIGIN_LABELS[input.origin]}` : null,
    formatCampaignLine(input),
    `Idioma: ${input.locale}`,
    `Consentimento LGPD: ${input.consent ? "sim" : "não"}`,
    "",
    "Mensagem:",
    input.message ?? "(não informada)",
  ].filter((line): line is string => line !== null);

  const text = lines.join("\n");
  const html = `<pre style="font-family: monospace; white-space: pre-wrap;">${escapeHtml(text)}</pre>`;

  return { subject, text, html };
}

/**
 * Linha única de campanha (UTM), só quando há pelo menos um dos três
 * parâmetros. Cada parte é rotulada porque `google / cpc / verao` sozinho
 * seria ambíguo para quem lê o e-mail.
 */
function formatCampaignLine(input: ContactInput): string | null {
  const parts = [
    input.utmSource ? `origem ${input.utmSource}` : null,
    input.utmMedium ? `mídia ${input.utmMedium}` : null,
    input.utmCampaign ? `campanha ${input.utmCampaign}` : null,
  ].filter((part): part is string => part !== null);

  return parts.length > 0 ? `Campanha (UTM): ${parts.join(" · ")}` : null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
