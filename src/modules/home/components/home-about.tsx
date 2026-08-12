import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

type HomeAboutContent = Dictionary["home"]["about"];

type HomeAboutStats = {
  totalProducts: number;
  totalCategories: number;
};

type HomeAboutProps = {
  content: HomeAboutContent;
  ctaHref: string;
  locale: Locale;
  stats: HomeAboutStats;
};

/**
 * Seção institucional da home. Os 4 highlights (fundação, sedes, GPTW,
 * exportação) vêm prontos do dicionário; um 5º card é montado aqui com dados
 * reais do catálogo (total de produtos publicados + categorias ativas).
 *
 * Nem `home.about.paragraphs` nem `home.categories.description` trazem um
 * placeholder (`{count}`) para interpolar esse número — por instrução
 * explícita da tarefa, quando isso acontece o card extra é construído em
 * código com um rótulo curto, em vez de inventar uma chave nova no
 * dicionário (que já foi fechado por outro agente nesta sessão). É uma
 * exceção pontual à regra "toda copy vem do dicionário": o valor é dado
 * (varia conforme o catálogo cresce), não texto de marketing.
 */
export function HomeAbout({ content, ctaHref, locale, stats }: HomeAboutProps) {
  const catalogHighlight = {
    label: locale === "en" ? "ROCO Catalog" : "Catálogo ROCO",
    value:
      locale === "en"
        ? `${stats.totalProducts}+ products across ${stats.totalCategories} categories`
        : `${stats.totalProducts}+ produtos em ${stats.totalCategories} categorias`,
  };
  const highlights = [...content.highlights, catalogHighlight];

  return (
    <section className="relative px-6 py-20 sm:py-24">
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
            <Link href={ctaHref} className="btn-neon mt-2 w-fit">
              {content.cta.label}
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {highlights.map((highlight, index) => (
              <div
                key={highlight.label}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/20"
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
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
