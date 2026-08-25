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
import type { ContactInput } from "./contact-submit";

export type ContactEmailContent = { subject: string; text: string; html: string };

const SUBJECT_LABELS: Record<ContactInput["subject"], string> = {
  call_back: "Ligamos pra você",
  quote: "Solicitação de orçamento",
  general: "Contato geral",
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
