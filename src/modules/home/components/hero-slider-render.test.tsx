/**
 * Render SSR do hero da home: a logo 3D aparece em TODOS os slides — vídeo
 * enviado (upload), YouTube — e no slide de reserva (banco sem slides ativos).
 */
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import pt from "@/i18n/dictionaries/pt.json";
import type { PublicHeroSlide } from "@/server/lib/hero-slides";
import { HeroSlider } from "./hero-slider";

const copy = {
  carousel: pt.home.hero.carousel,
  primaryCtaFallback: { label: pt.home.hero.primaryCta.label, href: "/pt/produtos" },
  fallbackSlide: {
    eyebrow: pt.home.hero.eyebrow,
    headline: pt.home.hero.headline,
    description: pt.home.hero.description,
    secondaryCta: { label: pt.home.hero.secondaryCta.label, href: "https://catalogo.roco.com.br/catalogo-roco" },
  },
  brand: "ROCO",
  logoSrc: "/images/logos/roco-logo-3d.png",
  logoWidth: 1474,
  logoHeight: 654,
  scrollCue: pt.home.hero.scrollCue,
};

function slide(kind: PublicHeroSlide["kind"]): PublicHeroSlide {
  return {
    id: `slide-${kind}`,
    slug: `slide-${kind}`,
    kind,
    youtubeId: kind === "youtube" ? "rqn-okkh0ww" : null,
    videoUrl: kind === "upload" ? "https://exemplo.r2.dev/hero/institucional.mp4" : null,
    posterUrl: null,
    eyebrow: "Soluções Industriais",
    headline: "Hidrossanitários e Hidráulica com Qualidade",
    headlineEn: null,
    description: "Conheça a linha completa de produtos ROCO.",
    descriptionEn: null,
    primaryCta: { label: "Conheça nossos Produtos", href: "/pt/produtos" },
    secondaryCta: null,
    loopWindow: null,
    muted: true,
    autoAdvanceSeconds: 5,
  };
}

function logoCount(html: string): number {
  return html.match(/<img[^>]*alt="ROCO"[^>]*>/g)?.filter((tag) => tag.includes("roco-logo-3d.png")).length ?? 0;
}

describe("HeroSlider: logo 3D", () => {
  it("aparece no slide de vídeo enviado (upload)", () => {
    expect(logoCount(renderToString(<HeroSlider slides={[slide("upload")]} copy={copy} />))).toBe(1);
  });

  it("aparece no slide do YouTube", () => {
    expect(logoCount(renderToString(<HeroSlider slides={[slide("youtube")]} copy={copy} />))).toBe(1);
  });

  it("aparece no primeiro slide quando há vários, qualquer que seja o tipo", () => {
    const html = renderToString(<HeroSlider slides={[slide("upload"), slide("youtube")]} copy={copy} />);
    expect(logoCount(html)).toBe(1);
  });

  it("aparece no slide de reserva, sem slides no banco", () => {
    expect(logoCount(renderToString(<HeroSlider slides={[]} copy={copy} />))).toBe(1);
  });
});
