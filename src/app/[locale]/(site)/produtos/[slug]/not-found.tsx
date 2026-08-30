import Link from "next/link";
import { cookies, headers } from "next/headers";
import { productsPath } from "@/core/config/site";
import { defaultLocale, locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { SiteHeader } from "@/shared/components/nav";
import { siteNavLinks } from "@/shared/lib/nav";

/**
 * Not-found boundary for `/{locale}/produtos/[slug]`.
 *
 * `notFound()` thrown from `page.tsx` renders THIS file instead of the page,
 * and — unlike `page.tsx`/`layout.tsx` — Next.js does NOT pass `params` to
 * nested `not-found.tsx` convention files (verified against the installed
 * Next 16.3.0 source: `createComponentTree` invokes the not-found/error/
 * forbidden/unauthorized boundary components with `createElement(Component,
 * null)`, no props at all, while `page`/`layout` receive `params`). So the
 * locale can't come from route params here; `generateMetadata` in
 * `page.tsx` still gets it, which is why `<title>` stays locale-correct even
 * when the fallbacks below miss.
 *
 * Two request-scoped signals, both official Next.js APIs (no gambiarra),
 * checked in order:
 * 1. The `NEXT_LOCALE` cookie `proxy.ts` (middleware) sets on every response
 *    — same source of truth `app/layout.tsx` uses for `<html lang>`.
 * 2. The `Accept-Language` request header — mirrors `resolveLocale()` in
 *    `proxy.ts`, kept local here (not extracted into a shared helper) since
 *    that one runs on `NextRequest` in the Edge/middleware runtime while this
 *    one reads `next/headers` in the Node/RSC runtime.
 * Verified empirically (2026-08-11, `npm run dev`) that #1 alone is not
 * reliable for a visitor's very first request in this environment — no
 * `Set-Cookie` header is observed on ANY route (not specific to this file;
 * a pre-existing `proxy.ts` behavior, out of scope here) — hence #2 as a
 * second, independently-reliable signal before giving up and defaulting to
 * `defaultLocale` (pt), which is an accepted degradation for a 404 page.
 */
async function resolveLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  if (cookieLocale && locales.includes(cookieLocale as Locale)) {
    return cookieLocale as Locale;
  }

  const headerStore = await headers();
  const acceptLanguage = headerStore.get("accept-language");
  const preferredLocale = acceptLanguage
    ?.split(",")
    .map((part) => part.split(";")[0]?.trim().slice(0, 2))
    .find((locale) => locales.includes(locale as Locale));

  return (preferredLocale as Locale) ?? defaultLocale;
}

export default async function ProductNotFound() {
  const locale = await resolveLocale();
  const dictionary = await getDictionary(locale);
  const { navigation, products } = dictionary;

  const navLinks = siteNavLinks(navigation.links, locale);

  return (
    <div className="relative min-h-[100svh] w-full bg-[#05070b]">
      <SiteHeader
        brand={navigation.brand}
        links={navLinks}
        menuLabels={{ open: navigation.menu, close: navigation.close }}
        locale={locale}
        controls={{ language: navigation.language, portalLogin: navigation.portalLogin }}
      />
      <main className="relative z-10 mx-auto flex min-h-[70svh] max-w-2xl flex-col items-center justify-center gap-4 px-6 pt-24 text-center">
        <h1 className="font-display text-h1 text-white">{products.detail.notFoundTitle}</h1>
        <p className="text-body text-white/70">{products.detail.notFoundDescription}</p>
        <Link href={productsPath(locale)} className="btn-neon mt-4">
          {products.detail.backToListing}
        </Link>
      </main>
    </div>
  );
}
