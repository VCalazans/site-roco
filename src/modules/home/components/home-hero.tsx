import { SiteHeader } from "@/shared/components/nav";
import { getCachedActiveHeroSlides } from "@/server/lib/hero-slides";
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
  const slides = await getCachedActiveHeroSlides(locale);

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

// Re-export utilitários que o caller pode precisar (mantém compat com o
// componente anterior caso outro ponto importe `externalProps`/`Cta`).
export { externalProps };
