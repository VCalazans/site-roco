"use server";

import { signOut } from "@/core/auth";

/**
 * Mesmo contrato de `@/core/auth` documentado em `login-action.ts`. Chamada
 * diretamente a partir de um `onClick` no client (`portal-shell.tsx`) — uma
 * Server Action pode ser invocada como função async comum a partir de um
 * event handler, sem precisar de `<form>`.
 */
export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/portal/login" });
}
