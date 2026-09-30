import type { Locale } from "@/i18n/config";

/**
 * Caminhos das telas públicas de conta do portal — fonte única para as
 * páginas, os links dos e-mails (`@/server/lib/app-url`) e o middleware
 * (`src/proxy.ts`), que deixa estas telas de fora do login obrigatório.
 */
export const ACCOUNT_PAGE_SEGMENTS = {
  confirmEmail: "confirmar-email",
  forgotPassword: "esqueci-senha",
  resetPassword: "redefinir-senha",
} as const;

export type AccountPageSegment = (typeof ACCOUNT_PAGE_SEGMENTS)[keyof typeof ACCOUNT_PAGE_SEGMENTS];

/** Segmentos de `/{locale}/portal/…` acessíveis sem sessão. */
export const PORTAL_PUBLIC_SEGMENTS: readonly string[] = ["login", ...Object.values(ACCOUNT_PAGE_SEGMENTS)];

/** `?notice=` da tela de login: aviso de sucesso vindo da redefinição de senha. */
export const LOGIN_NOTICE_PASSWORD_RESET = "password_reset";

export function portalLoginPath(locale: Locale, notice?: string): string {
  return notice ? `/${locale}/portal/login?notice=${notice}` : `/${locale}/portal/login`;
}

export function accountPagePath(locale: Locale, segment: AccountPageSegment): string {
  return `/${locale}/portal/${segment}`;
}
