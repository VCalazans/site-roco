import "server-only";
import type { NextRequest } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/core/auth";
import { hasPermission } from "@/core/auth/rbac";
import { defaultLocale, locales, type Locale } from "@/i18n/config";

export const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

/** Idioma do visitante pelo cookie que o middleware grava (padrão: `defaultLocale`). */
export function requestLocale(request: NextRequest): Locale {
  const value = request.cookies.get("NEXT_LOCALE")?.value;
  return locales.find((locale) => locale === value) ?? defaultLocale;
}

/** Erro em texto simples — rotas de download são abertas direto pelo navegador, não por `fetch`. */
export function plainTextResponse(status: number, message: string, headers: Record<string, string> = {}) {
  return new Response(message, {
    status,
    headers: { ...NO_STORE_HEADERS, "Content-Type": "text/plain; charset=utf-8", ...headers },
  });
}

type RoutePermission = { resource: string; action: string };

export type PortalRouteAccess =
  | { status: "allowed"; session: Session; locale: Locale }
  | { status: "unauthenticated"; response: Response }
  | { status: "forbidden"; locale: Locale };

/**
 * Sessão + permissão de um Route Handler do portal (downloads de arquivo).
 *
 * Sem sessão: 303 para o login no idioma do visitante, voltando a `returnPath`
 * depois de entrar. `Location` RELATIVA de propósito: no servidor standalone
 * (imagem Docker) `request.nextUrl.origin` é o host de bind
 * (`http://0.0.0.0:3000`), e um redirect absoluto montado com ele quebra.
 *
 * Sem permissão: `forbidden` — a rota responde com a mensagem do dicionário
 * no idioma devolvido.
 */
export async function authorizePortalRoute(
  request: NextRequest,
  permission: RoutePermission,
  returnPath: (locale: Locale) => string
): Promise<PortalRouteAccess> {
  const locale = requestLocale(request);
  const session = await auth();

  if (!session?.user) {
    const callbackUrl = encodeURIComponent(returnPath(locale));
    return {
      status: "unauthenticated",
      response: new Response(null, {
        status: 303,
        headers: { ...NO_STORE_HEADERS, Location: `/${locale}/portal/login?callbackUrl=${callbackUrl}` },
      }),
    };
  }

  if (!hasPermission(session, permission.resource, permission.action)) {
    return { status: "forbidden", locale };
  }

  return { status: "allowed", session, locale };
}
