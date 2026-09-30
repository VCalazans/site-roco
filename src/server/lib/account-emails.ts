import { interpolate } from "@/shared/lib/interpolate";

/**
 * E-mails de conta (confirmação de cadastro, redefinição e aviso de senha
 * alterada) — puros e testáveis. Todo texto vem do dicionário (`emails`);
 * aqui só o layout. Versão HTML e texto puro sempre juntas (cliente de e-mail
 * sem HTML e filtros de spam contam isso).
 *
 * Cores fixas no HTML de propósito: cliente de e-mail não lê as variáveis de
 * CSS do site. Tudo que vem de fora (nome, link) é escapado.
 */
export type AccountEmailKind = "verifyEmail" | "resetPassword" | "passwordChanged";

type EmailSection = { subject: string; intro: string; button: string; note: string; ignore: string };

export type AccountEmailsCopy = {
  brand: string;
  /** Placeholder literal `{name}`. */
  greeting: string;
  greetingNoName: string;
  linkFallback: string;
  footer: string;
} & Record<AccountEmailKind, EmailSection>;

export type BuiltEmail = { subject: string; text: string; html: string };

const COLORS = { text: "#1f2933", muted: "#5f6b7a", button: "#0a6f93", border: "#e3e8ee", background: "#f4f6f8" };

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Teto do nome na saudação — um primeiro nome real cabe folgado. */
const GREETING_NAME_MAX = 40;

/**
 * Nome da saudação: só o PRIMEIRO nome e só letras (com acento), apóstrofo e
 * hífen. O nome vem do formulário público de pré-cadastro — quem cadastra o
 * e-mail de outra pessoa não consegue pôr frase, telefone nem link num e-mail
 * que sai com a marca da ROCO (revisão de segurança 2026-09-30).
 */
export function greetingName(name: string | null | undefined): string {
  const first = name?.trim().split(/\s+/)[0] ?? "";
  const letters = first
    .replace(/[^\p{L}\p{M}'’-]/gu, "")
    .replace(/^['’-]+|['’-]+$/g, "")
    .slice(0, GREETING_NAME_MAX);
  // Sem nenhuma letra ("0800-123"), a saudação genérica assume.
  return /\p{L}/u.test(letters) ? letters : "";
}

export function buildAccountEmail(
  kind: AccountEmailKind,
  copy: AccountEmailsCopy,
  params: { name?: string | null; link: string; locale?: "pt" | "en" }
): BuiltEmail {
  const section = copy[kind];
  const name = greetingName(params.name);
  const greeting = name ? interpolate(copy.greeting, { name }) : copy.greetingNoName;
  const extras = [section.note, section.ignore].filter((paragraph) => paragraph.trim() !== "");

  const text = [greeting, "", section.intro, "", `${section.button}: ${params.link}`, "", ...extras, "", "—", copy.footer].join(
    "\n"
  );

  const link = escapeHtml(params.link);
  const html = `<!doctype html>
<html lang="${params.locale === "en" ? "en" : "pt-BR"}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(section.subject)}</title></head>
<body style="margin:0;padding:0;background:${COLORS.background};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.background};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${COLORS.border};border-radius:12px;font-family:Arial,Helvetica,sans-serif;color:${COLORS.text};">
        <tr><td style="padding:24px 28px 8px;font-size:13px;font-weight:bold;letter-spacing:.08em;text-transform:uppercase;color:${COLORS.button};">${escapeHtml(copy.brand)}</td></tr>
        <tr><td style="padding:8px 28px 0;font-size:18px;font-weight:bold;">${escapeHtml(greeting)}</td></tr>
        <tr><td style="padding:12px 28px 0;font-size:15px;line-height:1.55;">${escapeHtml(section.intro)}</td></tr>
        <tr><td style="padding:24px 28px;">
          <a href="${link}" style="display:inline-block;background:${COLORS.button};color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 22px;border-radius:8px;">${escapeHtml(section.button)}</a>
        </td></tr>
        ${extras
          .map(
            (paragraph) =>
              `<tr><td style="padding:0 28px 12px;font-size:14px;line-height:1.55;color:${COLORS.muted};">${escapeHtml(paragraph)}</td></tr>`
          )
          .join("\n        ")}
        <tr><td style="padding:8px 28px 0;font-size:12px;line-height:1.5;color:${COLORS.muted};">${escapeHtml(copy.linkFallback)}<br><a href="${link}" style="color:${COLORS.button};word-break:break-all;">${link}</a></td></tr>
        <tr><td style="padding:20px 28px 24px;font-size:12px;color:${COLORS.muted};border-top:1px solid ${COLORS.border};margin-top:16px;">${escapeHtml(copy.footer)}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject: section.subject, text, html };
}
