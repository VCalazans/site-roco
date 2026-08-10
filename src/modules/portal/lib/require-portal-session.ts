import "server-only";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { auth } from "@/core/auth";
import type { Locale } from "@/i18n/config";

/**
 * Resolve a sessão do portal em Server Components. `proxy.ts` (fora do meu
 * domínio nesta onda) já é a guarda principal — bloqueia requests sem
 * sessão antes de chegar às páginas de `(internal)/portal/**`. Esta função é
 * uma segunda linha de defesa (não duplica a guarda, só evita renderizar a
 * página com `user` indefinido caso o proxy mude de comportamento ou a rota
 * seja alcançada por outro caminho) e centraliza o redirect para o login,
 * preservando `callbackUrl` para voltar à página de origem após autenticar.
 */
export async function requirePortalSession(
  locale: Locale,
  currentPath: string
): Promise<Session> {
  const session = await auth();
  if (!session?.user) {
    redirect(
      `/${locale}/portal/login?callbackUrl=${encodeURIComponent(currentPath)}`
    );
  }
  return session;
}
