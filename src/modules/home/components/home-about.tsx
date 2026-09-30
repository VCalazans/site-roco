import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/core/lib/utils";
import type { ResolvedHomeContent } from "@/modules/home/lib/home-content";
import { interpolate } from "@/shared/lib/interpolate";
import { externalProps } from "@/shared/lib/nav";

type HomeAboutProps = {
  content: ResolvedHomeContent["about"];
  ctaHref: string;
  stats: {
    totalProducts: number;
    totalCategories: number;
  };
};

/**
 * Seção institucional ("Quem é a ROCO") — `id="sobre"` é o alvo do CTA da
 * seção de fachada. Textos, destaques e CTA vêm do conteúdo EDITÁVEL da home
 * (painel → dicionário como padrão, ver `resolveHomeContent`); o card do
 * catálogo interpola números REAIS do banco (produtos publicados + categorias
 * ativas) — nunca estatística inventada (decisionLog 2026-08-11) — e pode ser
 * ocultado no painel.
 */
export function HomeAbout({ content, ctaHref, stats }: HomeAboutProps) {
  const highlights = content.showCatalogStats
    ? [
        ...content.highlights,
        {
          label: content.catalogHighlight.label,
          value: interpolate(content.catalogHighlight.value, {
            totalProducts: stats.totalProducts,
            totalCategories: stats.totalCategories,
          }),
        },
      ]
    : content.highlights;

  return (
    <section id="sobre" className="relative scroll-mt-20 px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <p className="text-glow-cyan text-meta font-semibold uppercase tracking-[0.2em] text-neon-cyan-bright">
          {content.eyebrow}
        </p>
        <h2 className="mt-3 max-w-2xl font-display text-h1 text-white">{content.headline}</h2>

        <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16">
          <div className="flex flex-col gap-4">
            {content.paragraphs.map((paragraph, index) => (
              <p key={index} className="text-body text-white/75">
                {paragraph}
              </p>
            ))}
            <Link href={ctaHref} {...externalProps(ctaHref)} className="btn-neon mt-2 w-fit">
              {content.cta.label}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>

          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {highlights.map((highlight, index) => (
              <li
                key={`${highlight.label}-${index}`}
                // Quantidade ímpar (ex.: 4 destaques + o card do catálogo): o
                // último ocupa as duas colunas em vez de ficar sozinho à esquerda.
                className={cn(
                  "rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/20",
                  highlights.length % 2 === 1 && index === highlights.length - 1 && "sm:col-span-2"
                )}
                style={{
                  boxShadow:
                    index % 2 === 0
                      ? "0 0 24px -8px rgba(53, 217, 255, 0.25)"
                      : "0 0 24px -8px rgba(245, 163, 60, 0.25)",
                }}
              >
                <p
                  className={
                    index % 2 === 0
                      ? "text-ui font-semibold text-neon-cyan-bright"
                      : "text-ui font-semibold text-neon-amber-bright"
                  }
                >
                  {highlight.label}
                </p>
                <p className="mt-1 text-meta text-white/70">{highlight.value}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
