import { resolveDestination } from "@/core/config/site";
import { SiteHeader } from "@/shared/components/nav";
import { getCachedActiveHeroSlides, type PublicHeroSlide } from "@/server/lib/hero-slides";
import { externalProps, type Cta, type NavLink } from "@/shared/lib/nav";
import { HeroSlider } from "./hero-slider";

type HomeHeroProps = {
  brand: string;
  /** Headline + descrição do dicionário original (`home.hero`) — usado
   *  como fallback caso o banco não tenha nenhum slide ativo. */
  fallback: {
    eyebrow: string;
    headline: string;
    description: string;
    primaryCta: Cta;
    secondaryCta: Cta;
    sceneAlt: string;
    scrollCue: string;
  };
  navLinks: NavLink[];
  menuLabels: { open: string; close: string };
  locale: import("@/i18n/config").Locale;
};

/**
 * Hero da home no padrão WEG, agora DINÂMICO. Lê os slides ativos do banco
 * (via `getCachedActiveHeroSlides(locale)`, cache tag "hero") e entrega para
 * o `<HeroSlider>` montar o carrossel. Fallback: quando o banco está vazio
 * (dev sem seed, ou admin esvaziou tudo), renderiza o conteúdo do
 * dicionário original + pôster estático.
 */
export async function HomeHero({ brand, fallback, navLinks, menuLabels, locale }: HomeHeroProps) {
  const slides = (await getCachedActiveHeroSlides(locale)).map((slide) =>
    resolveSlideCtas(slide, locale)
  );

  return (
    <>
      <SiteHeader brand={brand} links={navLinks} menuLabels={menuLabels} />
      <HeroSlider
        slides={slides}
        copy={{
          prev: fallback.scrollCue,
          next: fallback.scrollCue,
          of: "de",
          primaryCtaFallback: fallback.primaryCta,
          brand,
          logoSrc: "/images/hero/roco-logo.png",
          posterFallbackSrc: "/images/hero/hero-stage.jpg",
          sceneAltFallback: fallback.sceneAlt,
          scrollCue: fallback.scrollCue,
        }}
      />
    </>
  );
}

/**
 * Resolve os hrefs dos CTAs do slide — que são DADO, digitado em campo
 * livre pelo marketing em `/portal/hero`, e até agora iam crus para o
 * `<Link>`.
 *
 * Isso conserta dois bugs que estavam no ar: o CTA "Baixar Catálogo" do
 * hero está gravado como `#catalogo`, então virava um link morto (só
 * acrescentava a âncora à URL da home), e `/produtos` sem prefixo dependia
 * de um redirect do `proxy.ts` para não quebrar o locale. Como o campo
 * aceita URL externa, `resolveDestination` continua devolvendo intocado
 * qualquer coisa que não seja um dos placeholders conhecidos — e só anexa a
 * origem quando o destino é uma página interna de captura de lead.
 */
function resolveSlideCtas(slide: PublicHeroSlide, locale: string): PublicHeroSlide {
  return {
    ...slide,
    primaryCta: slide.primaryCta
      ? { ...slide.primaryCta, href: resolveDestination(slide.primaryCta.href, locale, "home-hero") }
      : null,
    secondaryCta: slide.secondaryCta
      ? {
          ...slide.secondaryCta,
          href: resolveDestination(slide.secondaryCta.href, locale, "home-hero"),
        }
      : null,
  };
}

// Re-export utilitários que o caller pode precisar (mantém compat com o
// componente anterior caso outro ponto importe `externalProps`/`Cta`).
export { externalProps };
