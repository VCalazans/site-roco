"use client";

import { useId } from "react";
import { Search, Trophy, X } from "lucide-react";
import { cn } from "@/core/lib/utils";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { PublicCategory } from "@/modules/products/lib/types";

type ListingContent = Dictionary["products"]["listing"];

/**
 * Nome de categoria para exibição. Os nomes vêm do ERP em caixa alta e às
 * vezes com `_` no lugar de espaço (`HIDRO_LATÃO`) — só o `_` é normalizado;
 * a caixa alta segue o estilo de rótulo do site (cards, eyebrows).
 */
export function categoryDisplayName(category: PublicCategory, locale: Locale): string {
  const name = locale === "en" && category.nameEn ? category.nameEn : category.namePt;
  return name.replace(/_/g, " ");
}

type ProductsFiltersProps = {
  locale: Locale;
  content: ListingContent;
  categories: PublicCategory[];
  categoryCounts: Record<string, number>;
  /** Total de produtos publicados (rótulo de "Todos os produtos"). */
  allCount: number;
  bestSellerCount: number;
  search: string;
  category: string;
  bestSeller: boolean;
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onBestSellerChange: (value: boolean) => void;
  onClear: () => void;
  /** Esconde o campo de busca (no mobile ele fica fora da gaveta, sempre à vista). */
  hideSearch?: boolean;
};

/**
 * Painel de filtros da listagem (spec 001, RF25): busca AO VIVO, "somente
 * campeões de vendas" e a lista de categorias com contagem de produtos
 * publicados. É a barra lateral no desktop e o conteúdo da gaveta no mobile —
 * o MESMO componente, então os dois nunca divergem.
 *
 * Categoria sem nenhum produto publicado não aparece (seria um beco sem
 * saída), exceto se for a selecionada (link antigo, por exemplo).
 */
export function ProductsFilters({
  locale,
  content,
  categories,
  categoryCounts,
  allCount,
  bestSellerCount,
  search,
  category,
  bestSeller,
  onSearchChange,
  onCategoryChange,
  onBestSellerChange,
  onClear,
  hideSearch = false,
}: ProductsFiltersProps) {
  const searchId = useId();
  const visibleCategories = categories.filter(
    (item) => (categoryCounts[item.slug] ?? 0) > 0 || item.slug === category
  );
  const hasFilters = Boolean(search || category || bestSeller);

  return (
    <div className="flex flex-col gap-6">
      {!hideSearch ? (
        <div>
          <label htmlFor={searchId} className="mb-2 block text-micro font-semibold uppercase tracking-[0.14em] text-white/55">
            {content.searchLabel}
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/40" aria-hidden />
            <input
              id={searchId}
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={content.searchPlaceholder}
              autoComplete="off"
              enterKeyHint="search"
              maxLength={80}
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-10 text-meta text-white outline-none transition placeholder:text-white/35 focus:border-neon-cyan focus:ring-2 focus:ring-neon-cyan/20"
            />
            {search ? (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                aria-label={content.clearSearch}
                title={content.clearSearch}
                className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
              >
                <X className="size-4" aria-hidden />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Só campeões: botão-alternância (aria-pressed), com o troféu âmbar do selo. */}
      <button
        type="button"
        aria-pressed={bestSeller}
        onClick={() => onBestSellerChange(!bestSeller)}
        className={cn(
          "flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition",
          bestSeller
            ? "border-neon-amber/60 bg-neon-amber/10 text-neon-amber-bright shadow-[0_0_20px_-8px_rgba(255,180,84,0.6)]"
            : "border-white/10 bg-white/[0.03] text-white/80 hover:border-neon-amber/40 hover:text-white"
        )}
      >
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full ring-1",
            bestSeller ? "bg-neon-amber-bright/15 ring-neon-amber-bright/60" : "bg-white/5 ring-white/15"
          )}
        >
          <Trophy className="size-4" aria-hidden />
        </span>
        <span className="flex-1 text-meta font-semibold leading-snug">
          {content.bestSellerFilter}
          <span className="ml-1.5 text-micro font-normal text-white/50">({bestSellerCount})</span>
        </span>
        {/* Interruptor visual (o estado real está em aria-pressed). */}
        <span
          aria-hidden
          className={cn(
            "relative h-5 w-9 shrink-0 rounded-full transition",
            bestSeller ? "bg-neon-amber-bright" : "bg-white/15"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 size-4 rounded-full bg-white shadow transition-all",
              bestSeller ? "left-[1.125rem]" : "left-0.5"
            )}
          />
        </span>
      </button>

      <nav aria-label={content.categoriesLabel}>
        <p className="mb-2 text-micro font-semibold uppercase tracking-[0.14em] text-white/55">{content.categoriesLabel}</p>
        <ul className="flex flex-col gap-0.5">
          <li>
            <CategoryButton
              active={!category}
              label={content.allProducts}
              count={allCount}
              onClick={() => onCategoryChange("")}
            />
          </li>
          {visibleCategories.map((item) => (
            <li key={item.slug}>
              <CategoryButton
                active={category === item.slug}
                label={categoryDisplayName(item, locale)}
                count={categoryCounts[item.slug] ?? 0}
                onClick={() => onCategoryChange(item.slug)}
              />
            </li>
          ))}
        </ul>
      </nav>

      {hasFilters ? (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-micro font-semibold text-white/70 transition hover:border-white/35 hover:text-white"
        >
          <X className="size-3.5" aria-hidden />
          {content.clearFilters}
        </button>
      ) : null}
    </div>
  );
}

function CategoryButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={cn(
        "group relative flex w-full items-center justify-between gap-3 rounded-lg py-2 pl-3.5 pr-2.5 text-left text-micro font-semibold uppercase tracking-[0.06em] transition",
        active ? "bg-neon-cyan/10 text-neon-cyan-bright" : "text-white/70 hover:bg-white/5 hover:text-white"
      )}
    >
      {/* Filete ciano do item ativo — segundo canal além da cor (WCAG 1.4.1). */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-1.5 left-0 w-0.5 rounded-full transition",
          active ? "bg-neon-cyan-bright shadow-[0_0_8px_rgba(53,217,255,0.8)]" : "bg-transparent"
        )}
      />
      <span className="min-w-0 flex-1 leading-snug">{label}</span>
      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-micro tabular-nums tracking-normal",
          active ? "bg-neon-cyan-bright/15 text-neon-cyan-bright" : "bg-white/5 text-white/45"
        )}
      >
        {count}
      </span>
    </button>
  );
}
