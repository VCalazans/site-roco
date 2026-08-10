"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/core/auth";

/**
 * Contrato acordado com o agente de auth (memory-bank/decisionLog.md,
 * 2026-08-09 — "Autenticação: Auth.js v5 + Google SSO"): `@/core/auth`
 * exporta `signIn`/`signOut` na assinatura padrão do Auth.js v5. Esse módulo
 * está sendo criado em paralelo por outro agente — até existir, `tsc` falha
 * aqui com "Cannot find module '@/core/auth'" (ver relatório final; NÃO é
 * este agente que cria `src/core/auth`).
 *
 * `callbackUrl` é fixado via `.bind(null, callbackUrl)` no server component
 * que monta o `<form action>` (`(internal)/portal/login/page.tsx`). Uma
 * Server Action usada como `action` de `<form>` é chamada pelo React com
 * `FormData` como argumento — não declaramos esse parâmetro aqui porque o
 * login por Google não lê nenhum campo do form, e TypeScript aceita uma
 * função com menos parâmetros onde uma com mais é esperada (o argumento
 * extra é simplesmente ignorado em runtime, como em qualquer função JS).
 */
function toSafeCallback(callbackUrl?: string): string {
  // Defesa em profundidade contra open redirect: o `redirect` default do
  // Auth.js já neutraliza URLs absolutas, mas aqui garantimos que só um path
  // interno (começando com "/" e não "//") chega ao fluxo de login.
  return callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
    ? callbackUrl
    : "/portal";
}

export async function loginWithGoogle(callbackUrl?: string): Promise<void> {
  await signIn("google", { redirectTo: toSafeCallback(callbackUrl) });
}

/**
 * Login tradicional (Credentials). Em caso de falha o Auth.js lança
 * `AuthError` — devolvemos o usuário à tela de login com `?error=credentials`
 * (mensagem genérica do dicionário; nunca dizemos se foi e-mail ou senha).
 * O `redirect()` do Next lança internamente — precisa ficar FORA do try/catch
 * para não ser engolido como se fosse erro de autenticação.
 */
export async function loginWithCredentials(
  loginPath: string,
  callbackUrl: string | undefined,
  formData: FormData
): Promise<void> {
  const safeLoginPath =
    loginPath.startsWith("/") && !loginPath.startsWith("//") ? loginPath : "/pt/portal/login";
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: toSafeCallback(callbackUrl),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`${safeLoginPath}?error=credentials`);
    }
    throw error;
  }
}
