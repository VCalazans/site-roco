import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { defaultLocale, locales, type Locale } from "./src/i18n/config";

const PUBLIC_FILE = /\.(.*)$/;

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

export function middleware(request: NextRequest) {
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
  const response = NextResponse.next();
  response.cookies.set("NEXT_LOCALE", currentLocale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
