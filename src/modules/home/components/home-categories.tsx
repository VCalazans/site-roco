import Link from "next/link";
import { Cable, Droplet, Flame, Package, Shapes, Wrench } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { PublicCategory } from "@/modules/products/lib/types";

type HomeCategoriesContent = Dictionary["home"]["categories"];

type HomeCategoriesProps = {
  content: HomeCategoriesContent;
  categories: PublicCategory[];
  locale: Locale;
  ctaHref: string;
};

/**
 * Não há ícone customizado por categoria ainda (o catálogo não guarda esse
 * dado) — rotaciona um conjunto genérico de ícones lucide-react, na mesma
 * linguagem do resto do nav/hero. Determinístico por índice, não por slug,
 * então o ícone de uma categoria pode mudar se a ordem/sortOrder mudar — é um
 * placeholder visual, não uma identidade fixa.
 */
const CATEGORY_ICONS = [Droplet, Wrench, Shapes, Cable, Flame, Package];

function categoryName(category: PublicCategory, locale: Locale): string {
  return locale === "en" && category.nameEn ? category.nameEn : category.namePt;
}

/**
 * Vitrine de categorias reais da home. Mostra só as categorias de topo
 * (`parentId === null`) — a lista completa (com subcategorias) fica reservada
 * para o filtro da página `/produtos`, onde granularidade extra ajuda; aqui,
 * na home, um grid enxuto de categorias-mãe é mais lido de relance (decisão
 * de UX, ver resumo final).
 */
export function HomeCategories({ content, categories, locale, ctaHref }: HomeCategoriesProps) {
  const topLevel = categories.filter((category) => !category.parentId);
  if (topLevel.length === 0) return null;

  return (
    <section className="relative px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl">
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

        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {topLevel.map((category, index) => {
            const Icon = CATEGORY_ICONS[index % CATEGORY_ICONS.length];
            const isCyan = index % 2 === 0;
            return (
              <Link
                key={category.slug}
                href={`/${locale}/produtos?category=${category.slug}`}
                className="group flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center transition hover:-translate-y-1"
                style={{
                  boxShadow: isCyan
                    ? "0 0 0 1px rgba(53,217,255,0.08) inset, 0 0 30px -12px rgba(53,217,255,0.4)"
                    : "0 0 0 1px rgba(245,163,60,0.08) inset, 0 0 30px -12px rgba(245,163,60,0.4)",
                }}
              >
                <Icon
                  className={isCyan ? "size-8 text-neon-cyan-bright" : "size-8 text-neon-amber-bright"}
                  aria-hidden
                />
                <span className="text-ui font-semibold text-white/90">
                  {categoryName(category, locale)}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
