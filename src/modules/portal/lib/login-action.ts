"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/core/auth";
import { isGoogleSignInEnabled } from "@/core/auth/google";
import { isLoginErrorCode } from "@/core/auth/sign-in-errors";

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
/**
 * Caminho interno do próprio site: começa com "/", não com "//", e não tem
 * barra invertida nem caractere de controle (`/\host` vira `//host` em
 * alguns navegadores — defesa em profundidade contra open redirect).
 */
function isInternalPath(value: string | undefined): value is string {
  return Boolean(value && value.startsWith("/") && !value.startsWith("//") && !/[\\\u0000-\u001f\u007f]/.test(value));
}

function toSafeCallback(callbackUrl?: string): string {
  // O `redirect` default do Auth.js já neutraliza URLs absolutas; aqui só um
  // caminho interno chega ao fluxo de login.
  return isInternalPath(callbackUrl) ? callbackUrl : "/portal";
}

export async function loginWithGoogle(callbackUrl?: string): Promise<void> {
  // Google desligado (padrão — ver `@/core/auth/google`): a action nem tenta.
  if (!isGoogleSignInEnabled()) return;
  await signIn("google", { redirectTo: toSafeCallback(callbackUrl) });
}

/**
 * Login tradicional (Credentials). Em caso de falha o Auth.js lança
 * `AuthError` — devolvemos o usuário à tela de login com `?error=credentials`
 * (mensagem genérica do dicionário; nunca dizemos se foi e-mail ou senha) ou,
 * se a senha conferiu mas o e-mail ainda não foi confirmado,
 * `?error=email_not_verified` (a tela oferece reenviar o link).
 * O `redirect()` do Next lança internamente — precisa ficar FORA do try/catch
 * para não ser engolido como se fosse erro de autenticação.
 */
export async function loginWithCredentials(
  loginPath: string,
  callbackUrl: string | undefined,
  formData: FormData
): Promise<void> {
  const safeLoginPath = isInternalPath(loginPath) ? loginPath : "/pt/portal/login";
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: toSafeCallback(callbackUrl),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // E-mail não confirmado, muitas tentativas ou limitador fora do ar têm
      // mensagem própria; o resto (inclusive senha errada) é o erro genérico.
      const code =
        error instanceof CredentialsSignin && isLoginErrorCode(error.code) ? error.code : "credentials";
      redirect(`${safeLoginPath}?error=${code}`);
    }
    throw error;
  }
}
