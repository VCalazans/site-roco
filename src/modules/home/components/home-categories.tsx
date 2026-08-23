import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { resolveCategoryCardHref } from "@/modules/home/lib/category-cards";

type HomeCategoriesContent = Dictionary["home"]["categories"];

type HomeCategoriesProps = {
  content: HomeCategoriesContent;
  /** Slugs reais do catálogo — valida os hrefs `?category=` dos cards. */
  categorySlugs: string[];
  locale: Locale;
  ctaHref: string;
};

/**
 * Vitrine de categorias da home, fiel ao PSD "Layout pag Produtos_OK_01.psd"
 * (docs/): 6 cards verticais com moldura neon ciano→âmbar, arte line-art neon
 * extraída do composite do PSD (as ilustrações não são camadas separáveis —
 * ver decisionLog 2026-08-23) e rótulo vivo em caixa alta. Os cards são as 6
 * MACRO-FAMÍLIAS de marketing aprovadas no design — não as 16 categorias do
 * ERP (essas ficam no filtro de `/produtos`); o mapa card→filtro vive nos
 * dicionários e degrada para a listagem completa se a categoria sumir do
 * catálogo (`resolveCategoryCardHref`).
 */
export function HomeCategories({ content, categorySlugs, locale, ctaHref }: HomeCategoriesProps) {
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
          <Link href={ctaHref} className="btn-neon shrink-0">
            {content.cta.label}
          </Link>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 lg:gap-5">
          {content.items.map((item) => (
            <Link
              key={item.label}
              href={resolveCategoryCardHref(item.href, locale, categorySlugs)}
              className="card-neon group aspect-[45/82]"
            >
              <span className="relative block h-full w-full overflow-hidden rounded-[25px] bg-background">
                <Image
                  src={item.image}
                  alt={item.alt}
                  fill
                  sizes="(min-width: 1024px) 16vw, (min-width: 640px) 33vw, 50vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                />
                {/* Scrim atrás do rótulo: em 2 das 6 artes o reflexo neon do
                    piso cai exatamente sob o texto (contraste ~1:1 medido na
                    revisão) — o degradê garante WCAG 1.4.3 sem alterar o
                    resto da arte. */}
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background via-background/55 to-transparent"
                />
                <span className="card-neon-label absolute inset-x-2 bottom-5 text-center text-ui font-semibold uppercase tracking-[0.14em]">
                  {item.label}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
