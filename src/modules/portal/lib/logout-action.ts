"use server";

import { signOut } from "@/core/auth";
import { defaultLocale, locales, type Locale } from "@/i18n/config";

/**
 * Mesmo contrato de `@/core/auth` documentado em `login-action.ts`. Chamada
 * diretamente a partir de um `onClick` no client (`portal-shell.tsx`) — uma
 * Server Action pode ser invocada como função async comum a partir de um
 * event handler, sem precisar de `<form>`.
 *
 * O locale chega LIGADO no servidor (`logoutAction.bind(null, locale)` em
 * `shell-props.ts`), mas argumento de Server Action é entrada do cliente:
 * só um locale conhecido compõe o destino — nunca um caminho arbitrário.
 */
export async function logoutAction(locale: string): Promise<void> {
  const target: Locale = (locales as readonly string[]).includes(locale) ? (locale as Locale) : defaultLocale;
  await signOut({ redirectTo: `/${target}/portal/login` });
}
