import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "./src/core/auth";
import { defaultLocale, locales, type Locale } from "./src/i18n/config";

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

export default auth((request) => {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.includes("/api") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const pathnameIsMissingLocale = locales.every(
    (locale) => !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`
  );

  if (pathnameIsMissingLocale) {
    const locale = resolveLocale(request);
    const response = NextResponse.redirect(
      new URL(`/${locale}${pathname}`, request.url)
    );
    response.cookies.set("NEXT_LOCALE", locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
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
  return response;
});

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
