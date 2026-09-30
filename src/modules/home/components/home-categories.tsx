import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { resolveCtaHref } from "@/core/config/site";
import type { Locale } from "@/i18n/config";
import { resolveCategoryCardHref } from "@/modules/home/lib/category-cards";
import type { ResolvedHomeContent } from "@/modules/home/lib/home-content";
import { Carousel } from "@/shared/components/carousel/carousel";
import { externalProps } from "@/shared/lib/nav";

type HomeCategoriesProps = {
  content: ResolvedHomeContent["categories"];
  /** Slugs reais do catálogo — valida os hrefs `?category=` dos cards. */
  categorySlugs: string[];
  locale: Locale;
  ctaHref: string;
  carouselLabels: { prev: string; next: string };
};

/**
 * Destino de um card: caminho da listagem SEM locale (`/produtos?category=…`,
 * formato dos cards padrão do dicionário e o que o operador digita no painel)
 * passa pela validação de categoria existente; placeholders e URLs externas
 * vão por `resolveCtaHref`.
 */
function cardHref(href: string, locale: Locale, categorySlugs: string[]): string {
  const isLocalePrefixed = /^\/(pt|en)(\/|$|\?)/.test(href);
  if (href.startsWith("/") && !href.startsWith("//") && !isLocalePrefixed) {
    return resolveCategoryCardHref(href, locale, categorySlugs);
  }
  return resolveCtaHref(href, locale, "home-categorias");
}

/**
 * Vitrine de categorias da home, fiel ao PSD "Layout pag Produtos_OK_01.psd":
 * cards verticais com moldura neon ciano→âmbar, arte line-art e rótulo vivo
 * em caixa alta. Cards, artes e textos são EDITÁVEIS no painel (padrão: as 6
 * macro-famílias do dicionário). No desktop os 6 cabem numa linha e o
 * carrossel some sozinho; no mobile vira trilho com setas e arraste — em vez
 * de 3 linhas de 2 cards altos.
 */
export function HomeCategories({ content, categorySlugs, locale, ctaHref, carouselLabels }: HomeCategoriesProps) {
  return (
    <section className="relative overflow-hidden px-6 py-20 sm:py-24">
      {/* Glows de ambiente dual-tone — eco do piso refletivo do PSD. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-[radial-gradient(60%_100%_at_25%_100%,rgba(53,217,255,0.08),transparent_70%),radial-gradient(60%_100%_at_75%_100%,rgba(245,163,60,0.07),transparent_70%)]"
      />
      <div className="relative mx-auto max-w-7xl">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <p className="text-glow-amber text-meta font-semibold uppercase tracking-[0.2em] text-neon-amber-bright">
              {content.eyebrow}
            </p>
            <h2 className="mt-3 font-display text-h1 text-white">{content.headline}</h2>
            <p className="mt-3 text-body text-white/70">{content.description}</p>
          </div>
          <Link href={ctaHref} {...externalProps(ctaHref)} className="btn-neon shrink-0">
            {content.cta.label}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>

        <Carousel
          className="mt-12"
          labels={carouselLabels}
          ariaLabel={content.headline}
          gapClassName="gap-4 lg:gap-5"
          itemClassName="w-[42%] sm:w-[30%] lg:w-[calc((100%-100px)/6)] pt-2"
        >
          {content.items.map((item, index) => {
            const href = cardHref(item.href, locale, categorySlugs);
            return (
              <Link
                key={`${item.label}-${index}`}
                href={href}
                {...externalProps(href)}
                className="card-neon group block aspect-[45/82]"
              >
                <span className="relative block h-full w-full overflow-hidden rounded-[25px] bg-background">
                  <Image
                    src={item.imageUrl}
                    alt={item.alt}
                    fill
                    sizes="(min-width: 1024px) 16vw, (min-width: 640px) 30vw, 42vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                  />
                  {/* Scrim atrás do rótulo: em 2 das 6 artes o reflexo neon do
                      piso cai exatamente sob o texto (contraste ~1:1 medido na
                      revisão) — o degradê garante WCAG 1.4.3. */}
                  <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background via-background/55 to-transparent"
                  />
                  <span className="card-neon-label absolute inset-x-2 bottom-5 text-center text-ui font-semibold uppercase tracking-[0.14em]">
                    {item.label}
                  </span>
                </span>
              </Link>
            );
          })}
        </Carousel>
      </div>
    </section>
  );
}
