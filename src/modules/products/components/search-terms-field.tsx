"use client";

import { useId, useRef, type KeyboardEvent } from "react";
import { Plus, Search, X } from "lucide-react";
import { cn } from "@/core/lib/utils";
import type { Dictionary } from "@/i18n/get-dictionary";
import { MAX_SEARCH_CHIPS, MAX_SEARCH_LENGTH } from "@/modules/products/lib/listing-filters";
import { interpolate } from "@/shared/lib/interpolate";
import { FilterChip } from "./filter-chip";

type ListingContent = Dictionary["products"]["listing"];

type SearchTermsFieldProps = {
  content: ListingContent;
  /** Texto ainda no campo — já filtra ao vivo, como mais um termo. */
  value: string;
  /** Termos fixados (chips). */
  terms: string[];
  /** A última tentativa de fixar um termo esbarrou no teto de chips. */
  limitHit: boolean;
  onChange: (value: string) => void;
  onCommit: () => void;
  onRemoveTerm: (term: string) => void;
  /**
   * `sidebar`: rótulo visível, dica sob o campo e os termos fixados logo
   * abaixo dele. `bar`: campo compacto da barra do mobile — os termos aparecem
   * na faixa de filtros ativos, que fica logo abaixo.
   */
  variant: "sidebar" | "bar";
  className?: string;
};

/**
 * Busca da listagem com vários termos (pedido do stakeholder, 2026-09-30):
 * Enter — ou o botão "+" — fixa o texto como um chip e LIBERA o campo para o
 * próximo termo, que refina o resultado (termos combinam em E). O texto ainda
 * no campo filtra ao vivo, então fixá-lo não muda a lista.
 *
 * O "x" nativo do `type="search"` é escondido: cada navegador o desenha de um
 * jeito (e o Firefox não desenha), e ele disputava espaço com os botões.
 */
export function SearchTermsField({
  content,
  value,
  terms,
  limitHit,
  onChange,
  onCommit,
  onRemoveTerm,
  variant,
  className,
}: SearchTermsFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const inputId = useId();
  const hintId = useId();
  const sidebar = variant === "sidebar";
  const draft = value.trim();
  const notice = limitHit ? interpolate(content.searchLimit, { max: MAX_SEARCH_CHIPS }) : null;
  const addLabel = interpolate(content.addSearchTerm, { term: draft });

  // Depois de um clique nos botões (que somem com o campo vazio), o foco volta
  // ao campo: o próximo termo já pode ser digitado.
  function refocus() {
    inputRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // `isComposing`: o Enter que confirma um caractere do IME não fixa termo.
    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      onCommit();
    }
  }

  return (
    <div className={className}>
      <label
        htmlFor={inputId}
        className={
          sidebar
            ? "mb-2 block text-micro font-semibold uppercase tracking-[0.14em] text-white/55"
            : "sr-only"
        }
      >
        {content.searchLabel}
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/40"
          aria-hidden
        />
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={content.searchPlaceholder}
          autoComplete="off"
          enterKeyHint="search"
          maxLength={MAX_SEARCH_LENGTH}
          aria-describedby={hintId}
          className={cn(
            "w-full rounded-xl border border-white/10 bg-white/5 pl-10 text-meta text-white outline-none transition placeholder:text-white/35 focus:border-neon-cyan focus:ring-2 focus:ring-neon-cyan/20 [&::-webkit-search-cancel-button]:[-webkit-appearance:none]",
            sidebar ? "py-2.5" : "py-3",
            draft ? "pr-[4.75rem]" : "pr-4"
          )}
        />
        {draft ? (
          <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
            <button
              type="button"
              onClick={() => {
                onChange("");
                refocus();
              }}
              aria-label={content.clearSearch}
              title={content.clearSearch}
              className="flex size-7 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
            >
              <X className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => {
                onCommit();
                refocus();
              }}
              aria-label={addLabel}
              title={addLabel}
              className="flex size-8 items-center justify-center rounded-lg bg-neon-cyan/15 text-neon-cyan-bright ring-1 ring-neon-cyan/40 transition hover:bg-neon-cyan/25"
            >
              <Plus className="size-4" aria-hidden />
            </button>
          </div>
        ) : null}
      </div>

      {/* Dica (barra lateral) ou aviso do teto de termos. Região viva: o aviso
          é anunciado quando aparece. Na barra do mobile só o aviso aparece. */}
      <p
        id={hintId}
        aria-live="polite"
        className={cn(
          "mt-2 text-micro leading-snug",
          notice ? "text-neon-amber-bright" : "text-white/45",
          !sidebar && !notice && "sr-only"
        )}
      >
        {notice ?? (sidebar ? content.searchHint : "")}
      </p>

      {sidebar && terms.length > 0 ? (
        <ul aria-label={content.searchTermsLabel} className="mt-3 flex flex-wrap gap-2">
          {terms.map((term) => (
            <FilterChip
              key={term}
              label={interpolate(content.termChip, { term })}
              removeLabel={interpolate(content.removeFilter, { label: term })}
              onRemove={() => {
                onRemoveTerm(term);
                refocus();
              }}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
