/**
 * Login com Google: DESLIGADO por padrão (decisão de 2026-09-30).
 *
 * Só liga com `AUTH_GOOGLE_ENABLED=true` E as credenciais do OAuth. Desligado,
 * o provedor nem é registrado no Auth.js — esconder só o botão deixaria
 * `/api/auth/signin/google` utilizável. Antes de religar, resolver o achado
 * da revisão de segurança de 2026-09-30: o 1º login Google concede a role
 * `representative` sem aprovação (`events.createUser` em `./index.ts`).
 */
export function isGoogleSignInEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return (
    env.AUTH_GOOGLE_ENABLED?.trim().toLowerCase() === "true" &&
    Boolean(env.AUTH_GOOGLE_ID?.trim()) &&
    Boolean(env.AUTH_GOOGLE_SECRET?.trim())
  );
}
