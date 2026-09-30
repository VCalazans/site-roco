import type { Locale } from "@/i18n/config";
import type { AccountPageSegment } from "@/modules/portal/lib/account-links";

/**
 * Origem pública do site para montar links enviados por e-mail.
 *
 * Vem SEMPRE da configuração (`AUTH_URL`, depois `NEXT_PUBLIC_SITE_URL`) e
 * nunca do header `Host` da requisição: com um Host forjado, o link de
 * redefinição de senha sairia apontando para o domínio de quem atacou — e o
 * token iria junto.
 */
export function getAppBaseUrl(env: Record<string, string | undefined> = process.env): string | null {
  for (const candidate of [env.AUTH_URL, env.NEXT_PUBLIC_SITE_URL]) {
    const value = candidate?.trim();
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol === "https:" || url.protocol === "http:") return url.origin;
    } catch {
      // valor inválido: tenta o próximo
    }
  }
  return null;
}

/** Páginas públicas de conta do portal (fora do login obrigatório — ver `src/proxy.ts`). */
export type AccountPage = AccountPageSegment;

/**
 * Link de uma página de conta. O token vai no FRAGMENTO (`#token=…`), que o
 * navegador nunca envia ao servidor: não aparece em log de proxy/CDN nem no
 * header `Referer` — só a página, no navegador, o lê.
 */
export function accountPageLink(baseUrl: string, locale: Locale, page: AccountPage, token?: string): string {
  const url = `${baseUrl}/${locale}/portal/${page}`;
  return token ? `${url}#token=${token}` : url;
}
