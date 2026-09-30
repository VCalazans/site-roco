import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { readSmtpConfig, type SmtpConfig } from "./smtp-config";

export type MailMessage = { to: string; subject: string; text: string; html: string };

export type MailResult = { status: "sent" } | { status: "not_configured" } | { status: "failed"; error: string };

declare global {
  var __rocoMailTransport: { key: string; transporter: Transporter } | undefined;
}

/** Um transporte por configuração (sobrevive ao HMR; troca se as envs mudarem). */
function getTransporter(config: SmtpConfig): Transporter {
  const key = JSON.stringify([config.host, config.port, config.secure, config.requireTLS, config.auth?.user]);
  if (globalThis.__rocoMailTransport?.key !== key) {
    const transporter = nodemailer.createTransport(
      {
        host: config.host,
        port: config.port,
        secure: config.secure,
        requireTLS: config.requireTLS,
        auth: config.auth,
        // Sem timeout, um SMTP que não responde prenderia a requisição.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      },
      {
        from: config.from,
        replyTo: config.replyTo,
        // As mensagens são sempre texto montado aqui: nada de anexar arquivo
        // local ou buscar URL a partir do conteúdo (classe das advisories do
        // nodemailer ≤ 10.0.5).
        disableFileAccess: true,
        disableUrlAccess: true,
      }
    );
    globalThis.__rocoMailTransport = { key, transporter };
  }
  return globalThis.__rocoMailTransport.transporter;
}

/** Endereço de e-mail dentro da mensagem de erro do servidor SMTP ("550 … <x@y>: …"). */
const EMAIL_IN_TEXT = /[^\s<>"'@]+@[^\s<>"']+/g;

/**
 * Motivo da falha para o log: código, código SMTP e mensagem — com os
 * endereços de e-mail trocados por `<e-mail>` (a resposta do servidor costuma
 * repetir o destinatário, e log não é lugar de dado pessoal).
 */
export function describeMailError(error: unknown): string {
  if (!(error instanceof Error)) return "erro desconhecido";
  const details = error as Error & { code?: string; responseCode?: number };
  const message = error.message.replace(EMAIL_IN_TEXT, "<e-mail>");
  return [details.code, details.responseCode, message].filter(Boolean).join(" · ").slice(0, 300);
}

/**
 * Envia um e-mail transacional pelo SMTP configurado (`SMTP_*`, `MAIL_FROM`).
 * Nunca lança: devolve o desfecho para quem chamou decidir.
 *
 * Sem SMTP configurado: em DESENVOLVIMENTO o e-mail inteiro (com o link) vai
 * para o log, para dar para testar sem servidor de e-mail; em PRODUÇÃO só um
 * erro no log — sem o conteúdo, que carrega links de uso único.
 */
export async function sendMail(message: MailMessage): Promise<MailResult> {
  const smtp = readSmtpConfig(process.env);
  if (smtp.status !== "ok") {
    const reason = smtp.status === "invalid" ? `SMTP inválido: ${smtp.reason}` : "SMTP não configurado";
    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[mailer] ${reason} — e-mail NÃO enviado (desenvolvimento). Para: ${message.to}\n` +
          `Assunto: ${message.subject}\n${message.text}`
      );
    } else {
      console.error(`[mailer] ${reason} — e-mail "${message.subject}" não foi enviado.`);
    }
    return { status: "not_configured" };
  }

  try {
    await getTransporter(smtp.config).sendMail({
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    return { status: "sent" };
  } catch (error) {
    const description = describeMailError(error);
    console.error(`[mailer] Falha ao enviar "${message.subject}": ${description}`);
    return { status: "failed", error: description };
  }
}
