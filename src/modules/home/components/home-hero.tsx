import { resolveCtaHref } from "@/core/config/site";
import type { Locale } from "@/i18n/config";
import { getCachedActiveHeroSlides, type PublicHeroSlide } from "@/server/lib/hero-slides";
import type { Cta } from "@/shared/lib/nav";
import { HeroSlider, type HeroCarouselLabels } from "./hero-slider";

/** Logo 3D oficial (identidade de 2026-09-29) — dimensões intrínsecas do arquivo recortado. */
const HERO_LOGO = { src: "/images/logos/roco-logo-3d.png", width: 1474, height: 654 } as const;

type HomeHeroProps = {
  brand: string;
  /** Conteúdo do dicionário (`home.hero`) — fallback quando o banco não tem
   *  nenhum slide ativo, mais os rótulos do carrossel. */
  fallback: {
    eyebrow: string;
    headline: string;
    description: string;
    primaryCta: Cta;
    secondaryCta: Cta;
    scrollCue: string;
    carousel: HeroCarouselLabels;
  };
  locale: Locale;
};

/**
 * Hero da home no padrão WEG, DINÂMICO: lê os slides ativos do banco (via
 * `getCachedActiveHeroSlides(locale)`, cache tag "hero") e entrega para o
 * `<HeroSlider>`. Fallback: banco vazio (dev sem seed, ou admin esvaziou
 * tudo) → fundo de marca + logo 3D + CTA do dicionário.
 *
 * O header NÃO é mais renderizado aqui: desde a spec 001 ele vive no layout
 * `(site)` e persiste entre páginas.
 */
export async function HomeHero({ brand, fallback, locale }: HomeHeroProps) {
  const slides = (await getCachedActiveHeroSlides(locale)).map((slide) => resolveSlideCtas(slide, locale));

  return (
    <HeroSlider
      slides={slides}
      copy={{
        carousel: fallback.carousel,
        primaryCtaFallback: {
          ...fallback.primaryCta,
          href: resolveCtaHref(fallback.primaryCta.href, locale, "home-hero"),
        },
        fallbackSlide: {
          eyebrow: fallback.eyebrow,
          headline: fallback.headline,
          description: fallback.description,
          secondaryCta: {
            ...fallback.secondaryCta,
            href: resolveCtaHref(fallback.secondaryCta.href, locale, "home-hero"),
          },
        },
        brand,
        logoSrc: HERO_LOGO.src,
        logoWidth: HERO_LOGO.width,
        logoHeight: HERO_LOGO.height,
        scrollCue: fallback.scrollCue,
      }}
    />
  );
}

/**
 * Resolve os hrefs dos CTAs do slide — DADO digitado em campo livre pelo
 * marketing em `/portal/hero`. `resolveCtaHref` troca placeholders
 * (`#catalogo` → página do catálogo), garante o prefixo de locale em caminho
 * interno digitado sem ele (`/produtos` → `/pt/produtos`, sem depender do
 * redirect do middleware) e só anexa a origem do lead em página de captura.
 * O valor já chegou validado pelo servidor (`isSafeHref` no router do hero).
 */
function resolveSlideCtas(slide: PublicHeroSlide, locale: string): PublicHeroSlide {
  return {
    ...slide,
    primaryCta: slide.primaryCta
      ? { ...slide.primaryCta, href: resolveCtaHref(slide.primaryCta.href, locale, "home-hero") }
      : null,
    secondaryCta: slide.secondaryCta
      ? { ...slide.secondaryCta, href: resolveCtaHref(slide.secondaryCta.href, locale, "home-hero") }
      : null,
  };
}
