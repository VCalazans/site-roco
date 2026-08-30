/**
 * Middleware do Next 16 (`proxy.ts`, sucessor do `middleware.ts`).
 *
 * ⚠️ ESTE ARQUIVO PRECISA FICAR EM `src/`, NUNCA NA RAIZ DO REPO.
 * O Next procura o proxy "no mesmo nível de `app/`" — e aqui `app/` mora em
 * `src/app`. Enquanto o arquivo esteve em `./proxy.ts` (raiz), ele foi
 * compilado mas NUNCA registrado: `.next/server/middleware-manifest.json`
 * saía com `"middleware": {}` e nenhuma requisição passava por aqui.
 * Sintomas observados (2026-08-25, dev e container de produção):
 *   - `/contato`, `/produtos`, `/portal` sem prefixo de locale → 404 em vez do
 *     redirect para `/{locale}/…`;
 *   - cookie `NEXT_LOCALE` nunca gravado (a resolução por Accept-Language
 *     jamais rodou);
 *   - o guard de sessão de `/portal`/`/admin` nunca executou — o que hoje
 *     protege essas rotas é só o `requireAuth()` dentro das páginas.
 * Verificação rápida depois de mexer aqui: `curl -I http://host/contato` tem
 * que responder 307 para `/pt/contato`, não 404.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/core/auth";
import { defaultLocale, locales, type Locale } from "@/i18n/config";
import {
  captureUtm,
  serializeUtmCookie,
  UTM_COOKIE,
  UTM_COOKIE_MAX_AGE,
} from "@/shared/lib/lead-origin";

const PUBLIC_FILE = /\.(.*)$/;

/** Segmentos protegidos (exigem sessão); `/admin` também exige role elevada. */
const PROTECTED_SECTIONS = new Set(["portal", "admin"]);
const ADMIN_ONLY_ROLES = new Set(["admin", "sales_manager"]);
const PORTAL_LOGIN_SEGMENT = "login";

function resolveLocale(request: NextRequest): Locale {
  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
  if (cookieLocale && locales.includes(cookieLocale as Locale)) {
    return cookieLocale as Locale;
  }

  const acceptLanguage = request.headers.get("accept-language");
  if (!acceptLanguage) {
    return defaultLocale;
  }

  const preferredLocale = acceptLanguage
    .split(",")
    .map((part) => part.split(";")[0]?.trim().slice(0, 2))
    .find((locale) => locales.includes(locale as Locale));

  return (preferredLocale as Locale) ?? defaultLocale;
}

/** `/{locale}/portal/login` (e subrotas) ficam de fora do gate de sessão. */
function isPortalLoginPath(pathname: string, locale: Locale): boolean {
  const prefix = `/${locale}/portal/${PORTAL_LOGIN_SEGMENT}`;
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Persiste a campanha externa (`utm_*`) da URL de ENTRADA num cookie de
 * primeira parte, para que ela sobreviva até o formulário de contato/catálogo
 * (ver `UTM_COOKIE` em `@/shared/lib/lead-origin`). O anúncio quase sempre
 * aponta para a home ou para um produto, e nenhum link interno propaga
 * querystring — sem isto, `traffic_source`/`traffic_medium`/`traffic_campaign`
 * chegariam vazios ao RD Station em praticamente todo tráfego pago.
 *
 * Último toque vence (campanha nova sobrescreve a anterior); URL SEM campanha
 * nunca apaga a que já estava guardada.
 */
function persistUtm(request: NextRequest, response: NextResponse): NextResponse {
  const serialized = serializeUtmCookie(
    captureUtm((param) => request.nextUrl.searchParams.get(param))
  );
  if (serialized) {
    response.cookies.set(UTM_COOKIE, serialized, {
      path: "/",
      maxAge: UTM_COOKIE_MAX_AGE,
      sameSite: "lax",
      httpOnly: true,
    });
  }
  return response;
}

export default auth((request) => {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.split("/")[1] === "api" ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const pathnameIsMissingLocale = locales.every(
    (locale) => !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`
  );

  if (pathnameIsMissingLocale) {
    const locale = resolveLocale(request);
    // `request.nextUrl.search` preservado de propósito: `new URL(path, base)`
    // descarta a querystring da origem, então um anúncio apontando para
    // `roco.com.br/?utm_source=…` (ou `/contato?produto=…`) perdia TODOS os
    // parâmetros antes de qualquer página renderizar.
    const response = NextResponse.redirect(
      new URL(`/${locale}${pathname}${request.nextUrl.search}`, request.url)
    );
    response.cookies.set("NEXT_LOCALE", locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return persistUtm(request, response);
  }

  const currentLocale = (pathname.split("/")[1] ?? defaultLocale) as Locale;
  const section = pathname.split("/")[2];

  if (section && PROTECTED_SECTIONS.has(section) && !isPortalLoginPath(pathname, currentLocale)) {
    const session = request.auth;

    if (!session?.user) {
      const loginUrl = new URL(`/${currentLocale}/portal/${PORTAL_LOGIN_SEGMENT}`, request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (section === "admin") {
      const userRoles = session.user.roles ?? [];
      const isAllowed = userRoles.some((role) => ADMIN_ONLY_ROLES.has(role));
      if (!isAllowed) {
        return NextResponse.redirect(new URL(`/${currentLocale}/portal`, request.url));
      }
    }
  }

  const response = NextResponse.next();
  response.cookies.set("NEXT_LOCALE", currentLocale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return persistUtm(request, response);
});

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
