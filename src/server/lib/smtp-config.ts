/**
 * Configuração do SMTP a partir das variáveis de ambiente — pura e testável.
 *
 * `SMTP_HOST` vazio = e-mail não configurado (o envio vira aviso no log).
 * Com host definido, `MAIL_FROM` é obrigatório: sem remetente o servidor SMTP
 * recusa ou, pior, o e-mail sai com um remetente que cai no spam.
 *
 * Criptografia: `SMTP_SECURE=true` usa TLS desde a conexão (porta 465);
 * senão a conexão sobe para TLS via STARTTLS, e `SMTP_REQUIRE_TLS` (padrão
 * `true`) RECUSA enviar se o servidor não oferecer — a senha do SMTP e o link
 * de redefinição nunca trafegam em texto puro. Só desligue para um
 * capturador de e-mail local de desenvolvimento.
 */
export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  requireTLS: boolean;
  auth?: { user: string; pass: string };
  from: string;
  replyTo?: string;
};

export type SmtpConfigResult =
  | { status: "not_configured" }
  | { status: "invalid"; reason: string }
  | { status: "ok"; config: SmtpConfig };

const trimmed = (value: string | undefined) => value?.trim() || undefined;

export function readSmtpConfig(env: Record<string, string | undefined>): SmtpConfigResult {
  const host = trimmed(env.SMTP_HOST);
  if (!host) return { status: "not_configured" };

  const from = trimmed(env.MAIL_FROM);
  if (!from) return { status: "invalid", reason: "MAIL_FROM vazio" };

  const secure = trimmed(env.SMTP_SECURE)?.toLowerCase() === "true";
  const portText = trimmed(env.SMTP_PORT);
  const port = portText ? Number(portText) : secure ? 465 : 587;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { status: "invalid", reason: `SMTP_PORT inválida (${portText})` };
  }

  const user = trimmed(env.SMTP_USER);
  return {
    status: "ok",
    config: {
      host,
      port,
      secure,
      requireTLS: !secure && trimmed(env.SMTP_REQUIRE_TLS)?.toLowerCase() !== "false",
      ...(user ? { auth: { user, pass: env.SMTP_PASSWORD ?? "" } } : {}),
      from,
      ...(trimmed(env.MAIL_REPLY_TO) ? { replyTo: trimmed(env.MAIL_REPLY_TO) } : {}),
    },
  };
}
