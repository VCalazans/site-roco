"use client";

import { useId } from "react";
import { Check, Trophy, X } from "lucide-react";
import { cn } from "@/core/lib/utils";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { PublicCategory } from "@/modules/products/lib/types";
import { SearchTermsField } from "./search-terms-field";

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
  /** Texto ainda no campo de busca. */
  draft: string;
  /** Termos de busca fixados (chips). */
  terms: string[];
  termLimitHit: boolean;
  selectedCategories: string[];
  bestSeller: boolean;
  onDraftChange: (value: string) => void;
  onCommitDraft: () => void;
  onRemoveTerm: (term: string) => void;
  onToggleCategory: (slug: string) => void;
  onClearCategories: () => void;
  onBestSellerChange: (value: boolean) => void;
  onClear: () => void;
  /** Esconde o campo de busca (no mobile ele fica fora da gaveta, sempre à vista). */
  hideSearch?: boolean;
};

/**
 * Painel de filtros da listagem (spec 001, RF25 + filtros combinados de
 * 2026-09-30): busca com vários termos, "somente campeões de vendas" e as
 * categorias com contagem de produtos publicados — MARCÁVEIS em conjunto
 * (produtos de qualquer uma das marcadas). É a barra lateral no desktop e o
 * conteúdo da gaveta no mobile — o MESMO componente, então os dois nunca
 * divergem.
 *
 * Categoria sem nenhum produto publicado não aparece (seria um beco sem
 * saída), exceto se estiver marcada (link antigo, por exemplo).
 */
export function ProductsFilters({
  locale,
  content,
  categories,
  categoryCounts,
  allCount,
  bestSellerCount,
  draft,
  terms,
  termLimitHit,
  selectedCategories,
  bestSeller,
  onDraftChange,
  onCommitDraft,
  onRemoveTerm,
  onToggleCategory,
  onClearCategories,
  onBestSellerChange,
  onClear,
  hideSearch = false,
}: ProductsFiltersProps) {
  const categoriesLabelId = useId();
  const categoriesHintId = useId();
  const visibleCategories = categories.filter(
    (item) => (categoryCounts[item.slug] ?? 0) > 0 || selectedCategories.includes(item.slug)
  );
  const hasFilters = Boolean(draft.trim() || terms.length || selectedCategories.length || bestSeller);

  return (
    <div className="flex flex-col gap-6">
      {!hideSearch ? (
        <SearchTermsField
          variant="sidebar"
          content={content}
          value={draft}
          terms={terms}
          limitHit={termLimitHit}
          onChange={onDraftChange}
          onCommit={onCommitDraft}
          onRemoveTerm={onRemoveTerm}
        />
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

      <div role="group" aria-labelledby={categoriesLabelId} aria-describedby={categoriesHintId}>
        <p id={categoriesLabelId} className="text-micro font-semibold uppercase tracking-[0.14em] text-white/55">
          {content.categoriesLabel}
        </p>
        <p id={categoriesHintId} className="mb-2 mt-0.5 text-micro text-white/40">
          {content.categoriesHint}
        </p>
        <ul className="flex flex-col gap-0.5">
          <li>
            {/* "Todos" é o estado SEM categoria marcada — clicar limpa a seleção. */}
            <button
              type="button"
              aria-pressed={selectedCategories.length === 0}
              onClick={onClearCategories}
              className={categoryRowClass(selectedCategories.length === 0)}
            >
              <CheckBox checked={selectedCategories.length === 0} />
              <span className="min-w-0 flex-1 leading-snug">{content.allProducts}</span>
              <CountBadge active={selectedCategories.length === 0} count={allCount} />
            </button>
          </li>
          {visibleCategories.map((item) => {
            const checked = selectedCategories.includes(item.slug);
            return (
              <li key={item.slug}>
                <label className={cn(categoryRowClass(checked), "cursor-pointer")}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleCategory(item.slug)}
                    className="sr-only"
                  />
                  <CheckBox checked={checked} />
                  <span className="min-w-0 flex-1 leading-snug">{categoryDisplayName(item, locale)}</span>
                  <CountBadge active={checked} count={categoryCounts[item.slug] ?? 0} />
                </label>
              </li>
            );
          })}
        </ul>
      </div>

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

/** Linha de categoria. O anel de foco segue o checkbox nativo (visualmente oculto) via `:has`. */
function categoryRowClass(active: boolean): string {
  return cn(
    "relative flex w-full items-center gap-3 rounded-lg py-2 pl-3 pr-2.5 text-left text-micro font-semibold uppercase tracking-[0.06em] transition",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/70 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-neon-cyan/70",
    active ? "bg-neon-cyan/10 text-neon-cyan-bright" : "text-white/70 hover:bg-white/5 hover:text-white"
  );
}

/** Caixa de marcação desenhada — o check é o segundo canal além da cor (WCAG 1.4.1). */
function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-[5px] border transition",
        checked
          ? "border-neon-cyan-bright bg-neon-cyan-bright text-background shadow-[0_0_8px_rgba(53,217,255,0.6)]"
          : "border-white/30 bg-white/[0.03]"
      )}
    >
      {checked ? <Check className="size-3" strokeWidth={3.5} /> : null}
    </span>
  );
}

function CountBadge({ active, count }: { active: boolean; count: number }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-micro tabular-nums tracking-normal",
        active ? "bg-neon-cyan-bright/15 text-neon-cyan-bright" : "bg-white/5 text-white/45"
      )}
    >
      {count}
    </span>
  );
}
