/**
 * Envio de verdade do e-mail de notificação interna via Resend (I/O —
 * `server-only`). O conteúdo puro é montado por
 * `buildContactNotificationEmail` (`./contact-email.ts`).
 *
 * NUNCA lança: o caller (`POST /api/contact`) já gravou o lead no banco
 * antes de chamar isto, então uma falha aqui não pode derrubar a resposta ao
 * visitante — só fica registrada em `contact_submissions` para retry/
 * investigação manual.
 */
import "server-only";
import type { ContactEmailContent } from "./contact-email";

export type ContactEmailSendResult = { ok: boolean; error?: string };

const RESEND_API_URL = "https://api.resend.com/emails";
const RESEND_TIMEOUT_MS = 8_000;

/**
 * Lê `RESEND_API_KEY`/`CONTACT_FROM_EMAIL` (segredos, nunca `NEXT_PUBLIC_*`)
 * e o destino via `CONTACT_NOTIFICATION_EMAIL` com fallback para
 * `NEXT_PUBLIC_CONTACT_EMAIL` (env pública que já existe no projeto). Sem
 * `RESEND_API_KEY`/`CONTACT_FROM_EMAIL` configuradas, isto é uma PENDÊNCIA
 * DE CONFIGURAÇÃO, não um bug: loga em nível `info` e retorna `ok: false`
 * sem barulho.
 *
 * `replyTo` é o e-mail do próprio lead — permite ao time comercial
 * responder direto pelo cliente de e-mail, sem copiar/colar.
 */
export async function sendContactNotificationEmail(
  content: ContactEmailContent,
  replyTo: string
): Promise<ContactEmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.CONTACT_FROM_EMAIL;
  const toEmail = process.env.CONTACT_NOTIFICATION_EMAIL || process.env.NEXT_PUBLIC_CONTACT_EMAIL;

  if (!apiKey || !fromEmail) {
    console.info(
      "[contact-email] RESEND_API_KEY/CONTACT_FROM_EMAIL não configuradas — e-mail não enviado (pendência de configuração)."
    );
    return { ok: false, error: "not_configured" };
  }

  if (!toEmail) {
    console.info(
      "[contact-email] Nenhum destino configurado (CONTACT_NOTIFICATION_EMAIL/NEXT_PUBLIC_CONTACT_EMAIL) — e-mail não enviado."
    );
    return { ok: false, error: "not_configured" };
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject: content.subject,
        html: content.html,
        text: content.text,
        reply_to: replyTo,
      }),
      signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
    });

    if (response.ok) {
      return { ok: true };
    }

    const body = await response.text().catch(() => "");
    console.error(`[contact-email] Resend respondeu ${response.status}.`, body);
    return { ok: false, error: `http_${response.status}` };
  } catch (error) {
    console.error("[contact-email] Falha ao enviar e-mail.", error);
    return { ok: false, error: "network" };
  }
}
