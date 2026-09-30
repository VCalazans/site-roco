"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Loader2, Search, SlidersHorizontal, Trophy, X } from "lucide-react";
import { cn } from "@/core/lib/utils";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { buildPaginationRange } from "@/modules/products/lib/pagination";
import { rememberListingUrl } from "@/modules/products/lib/listing-memory";
import type { PublicCategory, PublicProductItem } from "@/modules/products/lib/types";
import { ProductCard, type ProductCardContent } from "@/shared/components/product-card";
import { interpolate } from "@/shared/lib/interpolate";
import { categoryDisplayName, ProductsFilters } from "./products-filters";

const DEBOUNCE_MS = 350;

type ProductsExplorerProps = {
  locale: Locale;
  initialItems: PublicProductItem[];
  initialTotal: number;
  initialPage: number;
  perPage: number;
  categories: PublicCategory[];
  categoryCounts: Record<string, number>;
  allCount: number;
  bestSellerCount: number;
  initialFilters: { category: string; search: string; bestSeller: boolean };
  content: Dictionary["products"]["listing"];
  cardContent: ProductCardContent;
  badgeLabels: Dictionary["products"]["badges"];
  cartLabels: Dictionary["cart"]["addButton"];
};

type ExplorerFilters = { search: string; category: string; bestSeller: boolean; page: number };

/**
 * Explorador do catálogo (spec 001, RF14/RF25): barra lateral de filtros
 * (busca ao vivo, campeões, categorias com contagem) no desktop, gaveta no
 * mobile, chips dos filtros ativos, faixa "Mostrando X–Y de Z" e paginação
 * numerada com setas.
 *
 * Primeira página vem renderizada do servidor; a partir daí toda mudança usa
 * `GET /api/products` no cliente. URL sincronizada com `history.replaceState`
 * (integração nativa do App Router: atualiza `useSearchParams` SEM refetch RSC
 * — `router.replace` aqui re-executaria a consulta no servidor a cada tecla).
 *
 * Navegação externa para a MESMA rota (ex.: busca do header com outro termo):
 * o servidor manda props novas mas o React preserva a instância — o bloco de
 * adoção compara as props iniciais com as da última renderização e re-adota
 * quando mudam (padrão React de derived state, sem useEffect).
 */
export function ProductsExplorer({
  locale,
  initialItems,
  initialTotal,
  initialPage,
  perPage,
  categories,
  categoryCounts,
  allCount,
  bestSellerCount,
  initialFilters,
  content,
  cardContent,
  badgeLabels,
  cartLabels,
}: ProductsExplorerProps) {
  const pathname = usePathname();
  const resultsRef = useRef<HTMLDivElement | null>(null);

  const [search, setSearch] = useState(initialFilters.search);
  const [category, setCategory] = useState(initialFilters.category);
  const [bestSeller, setBestSeller] = useState(initialFilters.bestSeller);
  const [page, setPage] = useState(initialPage);
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  // Último conjunto filtros+página cujos resultados chegaram com sucesso —
  // usado para reverter estado e URL quando um fetch falha.
  const lastGoodRef = useRef<ExplorerFilters>({ ...initialFilters, page: initialPage });

  // Adoção de novas props do servidor (navegação externa para a mesma rota).
  const [prevInitial, setPrevInitial] = useState<ExplorerFilters>({ ...initialFilters, page: initialPage });
  if (
    prevInitial.search !== initialFilters.search ||
    prevInitial.category !== initialFilters.category ||
    prevInitial.bestSeller !== initialFilters.bestSeller ||
    prevInitial.page !== initialPage
  ) {
    const adopted: ExplorerFilters = { ...initialFilters, page: initialPage };
    setPrevInitial(adopted);
    setSearch(adopted.search);
    setCategory(adopted.category);
    setBestSeller(adopted.bestSeller);
    setPage(adopted.page);
    setItems(initialItems);
    setTotal(initialTotal);
    setLoading(false);
    setLoadError(false);
  }

  useEffect(() => {
    // Mesmo gatilho do bloco de adoção: invalida fetch em voo, cancela
    // debounce pendente e realinha o "último sucesso" às props adotadas.
    lastGoodRef.current = {
      search: initialFilters.search,
      category: initialFilters.category,
      bestSeller: initialFilters.bestSeller,
      page: initialPage,
    };
    requestIdRef.current += 1;
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, [initialFilters.search, initialFilters.category, initialFilters.bestSeller, initialPage]);

  useEffect(() => {
    // Lembra a listagem atual para o "Voltar aos produtos" do detalhe.
    rememberListingUrl(window.location.pathname + window.location.search);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Gaveta mobile: Escape fecha e a página não rola por baixo.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    const desktop = window.matchMedia("(min-width: 64rem)");
    const onBreakpoint = () => {
      if (desktop.matches) setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    desktop.addEventListener("change", onBreakpoint);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      desktop.removeEventListener("change", onBreakpoint);
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerOpen]);

  const syncUrl = useCallback(
    (next: ExplorerFilters) => {
      const qs = new URLSearchParams();
      if (next.search) qs.set("search", next.search);
      if (next.category) qs.set("category", next.category);
      if (next.bestSeller) qs.set("bestSeller", "1");
      if (next.page > 1) qs.set("page", String(next.page));
      const queryString = qs.toString();
      const url = queryString ? `${pathname}?${queryString}` : pathname;
      window.history.replaceState(null, "", url);
      rememberListingUrl(url);
    },
    [pathname]
  );

  const fetchProducts = useCallback(
    async (next: ExplorerFilters) => {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      setLoadError(false);

      const qs = new URLSearchParams();
      if (next.search) qs.set("search", next.search);
      if (next.category) qs.set("category", next.category);
      if (next.bestSeller) qs.set("bestSeller", "1");
      qs.set("page", String(next.page));
      qs.set("perPage", String(perPage));

      try {
        const response = await fetch(`/api/products?${qs.toString()}`);
        if (!response.ok) throw new Error(`Unexpected status ${response.status}`);
        const data = (await response.json()) as { items: PublicProductItem[]; total: number; page: number };

        // Resposta atrasada de uma requisição que não é mais a última é ignorada.
        if (requestId !== requestIdRef.current) return;
        setItems(data.items);
        setTotal(data.total);
        // O servidor clampa a página ao intervalo real — adota o valor efetivo.
        const effective = { ...next, page: data.page ?? next.page };
        if (effective.page !== next.page) {
          setPage(effective.page);
          syncUrl(effective);
        }
        lastGoodRef.current = effective;
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        console.error("[ProductsExplorer] failed to fetch products", error);
        // Reverte estado e URL para o último conjunto que carregou de fato.
        const prev = lastGoodRef.current;
        setSearch(prev.search);
        setCategory(prev.category);
        setBestSeller(prev.bestSeller);
        setPage(prev.page);
        syncUrl(prev);
        setLoadError(true);
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    },
    [perPage, syncUrl]
  );

  function apply(next: ExplorerFilters) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearch(next.search);
    setCategory(next.category);
    setBestSeller(next.bestSeller);
    setPage(next.page);
    syncUrl(next);
    fetchProducts(next);
  }

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const next = { search: value.trim(), category, bestSeller, page: 1 };
      setPage(1);
      syncUrl(next);
      fetchProducts(next);
    }, DEBOUNCE_MS);
  };

  const handleCategoryChange = (value: string) => apply({ search, category: value, bestSeller, page: 1 });
  const handleBestSellerChange = (value: boolean) => apply({ search, category, bestSeller: value, page: 1 });
  const handleClear = () => apply({ search: "", category: "", bestSeller: false, page: 1 });

  const handlePageChange = (nextPage: number) => {
    apply({ search, category, bestSeller, page: nextPage });
    // Volta ao topo dos RESULTADOS (não da página): o header é fixo, então o
    // alvo compensa a altura dele via `scroll-margin` do contêiner.
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    resultsRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  };

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  const selectedCategory = categories.find((item) => item.slug === category);
  const activeFilterCount = (category ? 1 : 0) + (bestSeller ? 1 : 0);

  const filtersProps = {
    locale,
    content,
    categories,
    categoryCounts,
    allCount,
    bestSellerCount,
    search,
    category,
    bestSeller,
    onSearchChange: handleSearchChange,
    onCategoryChange: (value: string) => {
      handleCategoryChange(value);
      setDrawerOpen(false);
    },
    onBestSellerChange: handleBestSellerChange,
    onClear: handleClear,
  };

  return (
    <div className="relative mx-auto max-w-7xl px-5 pb-20 sm:px-6">
      <div className="lg:grid lg:grid-cols-[19rem_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[20rem_minmax(0,1fr)] xl:gap-10">
        {/* Barra lateral (desktop). */}
        <aside aria-label={content.filtersTitle} className="hidden lg:block">
          <div className="sticky top-28 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h2 className="mb-5 font-display text-h2 text-white">{content.filtersTitle}</h2>
            <ProductsFilters {...filtersProps} />
          </div>
        </aside>

        <div ref={resultsRef} className="scroll-mt-28">
          {/* Barra do mobile: busca sempre à vista + botão da gaveta de filtros. */}
          <div className="flex items-center gap-3 lg:hidden">
            <label className="relative flex-1">
              <span className="sr-only">{content.searchLabel}</span>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/40" aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder={content.searchPlaceholder}
                autoComplete="off"
                enterKeyHint="search"
                maxLength={80}
                className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-meta text-white outline-none transition placeholder:text-white/35 focus:border-neon-cyan focus:ring-2 focus:ring-neon-cyan/20"
              />
            </label>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-expanded={drawerOpen}
              className="relative inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-meta font-semibold text-white transition hover:border-neon-cyan/50"
            >
              <SlidersHorizontal className="size-4" aria-hidden />
              {content.openFilters}
              {activeFilterCount > 0 ? (
                <span className="flex size-5 items-center justify-center rounded-full bg-neon-cyan-bright text-micro font-bold text-background">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
          </div>

          {/* Faixa de resultado + chips dos filtros ativos. */}
          <div className="mt-5 flex flex-col gap-3 lg:mt-0 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-meta text-white/60" aria-live="polite">
              {loading ? <Loader2 className="size-4 animate-spin text-neon-cyan-bright" aria-hidden /> : null}
              {total > 0
                ? interpolate(content.resultsRange, { from, to, total })
                : interpolate(content.resultsCount, { count: total })}
            </p>

            {search || selectedCategory || bestSeller ? (
              <ul className="flex flex-wrap items-center gap-2" aria-label={content.activeFilters}>
                {search ? (
                  <FilterChip
                    label={interpolate(content.searchChip, { term: search })}
                    removeLabel={interpolate(content.removeFilter, { label: search })}
                    onRemove={() => apply({ search: "", category, bestSeller, page: 1 })}
                  />
                ) : null}
                {selectedCategory ? (
                  <FilterChip
                    label={categoryDisplayName(selectedCategory, locale)}
                    removeLabel={interpolate(content.removeFilter, {
                      label: categoryDisplayName(selectedCategory, locale),
                    })}
                    onRemove={() => apply({ search, category: "", bestSeller, page: 1 })}
                  />
                ) : null}
                {bestSeller ? (
                  <FilterChip
                    tone="amber"
                    icon={<Trophy className="size-3.5" aria-hidden />}
                    label={content.bestSellerFilter}
                    removeLabel={interpolate(content.removeFilter, { label: content.bestSellerFilter })}
                    onRemove={() => apply({ search, category, bestSeller: false, page: 1 })}
                  />
                ) : null}
              </ul>
            ) : null}
          </div>

          {loadError ? (
            <p
              role="alert"
              className="mt-6 rounded-xl border border-neon-amber/40 bg-neon-amber/10 px-4 py-3 text-meta text-neon-amber-bright"
            >
              {content.loadError}
            </p>
          ) : null}

          {items.length === 0 && !loading ? (
            <div className="mt-10 flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-14 text-center">
              <p className="text-body text-white/70">{content.emptyState}</p>
              {search || category || bestSeller ? (
                <button type="button" onClick={handleClear} className="btn-neon">
                  {content.clearFilters}
                </button>
              ) : null}
            </div>
          ) : (
            <div
              aria-busy={loading}
              className="mt-6 grid grid-cols-2 gap-4 transition-opacity sm:grid-cols-3"
              style={{ opacity: loading ? 0.6 : 1 }}
            >
              {items.map((item, index) => (
                <ProductCard
                  key={item.slug}
                  item={item}
                  locale={locale}
                  href={`/${locale}/produtos/${item.slug}`}
                  content={cardContent}
                  badgeLabels={badgeLabels}
                  cartLabels={cartLabels}
                  priority={index < 3}
                  morphImage
                />
              ))}
            </div>
          )}

          {totalPages > 1 ? (
            <Pagination
              page={page}
              totalPages={totalPages}
              labels={content.pagination}
              onChange={handlePageChange}
            />
          ) : null}
        </div>
      </div>

      {/* Gaveta de filtros (mobile). */}
      <AnimatePresence>
        {drawerOpen ? (
          <>
            <motion.button
              key="filters-backdrop"
              type="button"
              aria-hidden
              tabIndex={-1}
              onClick={() => setDrawerOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] cursor-default bg-black/60 lg:hidden"
            />
            <motion.div
              key="filters-drawer"
              role="dialog"
              aria-modal="true"
              aria-label={content.filtersTitle}
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-y-0 left-0 z-[61] flex w-[min(22rem,88vw)] flex-col border-r border-white/10 bg-[#05070b] shadow-[20px_0_60px_rgba(0,0,0,0.6)] lg:hidden"
            >
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <h2 className="font-display text-h2 text-white">{content.filtersTitle}</h2>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label={content.closeFilters}
                  className="flex size-10 items-center justify-center rounded-full border border-white/15 text-white transition hover:bg-white/10"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-5">
                <ProductsFilters {...filtersProps} hideSearch />
              </div>
              <div className="border-t border-white/10 p-4">
                <button type="button" onClick={() => setDrawerOpen(false)} className="btn-neon w-full">
                  {interpolate(content.showResults, { count: total })}
                </button>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function FilterChip({
  label,
  removeLabel,
  onRemove,
  icon,
  tone = "cyan",
}: {
  label: string;
  removeLabel: string;
  onRemove: () => void;
  icon?: ReactNode;
  tone?: "cyan" | "amber";
}) {
  return (
    <li>
      <span
        className={cn(
          "inline-flex max-w-[16rem] items-center gap-1.5 rounded-full border py-1 pl-3 pr-1 text-micro font-semibold",
          tone === "amber"
            ? "border-neon-amber/50 bg-neon-amber/10 text-neon-amber-bright"
            : "border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan-bright"
        )}
      >
        {icon}
        <span className="truncate">{label}</span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          title={removeLabel}
          className="flex size-6 items-center justify-center rounded-full transition hover:bg-white/10"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </span>
    </li>
  );
}

function Pagination({
  page,
  totalPages,
  labels,
  onChange,
}: {
  page: number;
  totalPages: number;
  labels: Dictionary["products"]["listing"]["pagination"];
  onChange: (page: number) => void;
}) {
  const range = buildPaginationRange(page, totalPages);
  const arrowClass =
    "flex size-10 items-center justify-center rounded-full border border-white/10 text-white transition hover:border-neon-cyan/50 hover:text-neon-cyan-bright disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-white/10 disabled:hover:text-white";

  return (
    <nav aria-label={labels.label} className="mt-12 flex flex-col items-center gap-3">
      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          aria-label={labels.previous}
          title={labels.previous}
          className={arrowClass}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>

        <ol className="flex items-center gap-1 sm:gap-1.5">
          {range.map((item) =>
            typeof item === "number" ? (
              <li key={item}>
                <button
                  type="button"
                  onClick={() => onChange(item)}
                  aria-label={interpolate(labels.goToPage, { page: item })}
                  aria-current={item === page ? "page" : undefined}
                  className={cn(
                    "flex h-10 min-w-10 items-center justify-center rounded-full px-2 text-meta tabular-nums transition",
                    item === page
                      ? "bg-neon-cyan-bright font-semibold text-background shadow-[0_0_18px_rgba(53,217,255,0.45)]"
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                  )}
                >
                  {item}
                </button>
              </li>
            ) : (
              <li key={item} aria-hidden className="px-1 text-white/40">
                …
              </li>
            )
          )}
        </ol>

        <button
          type="button"
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          aria-label={labels.next}
          title={labels.next}
          className={arrowClass}
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
      <p className="text-micro text-white/50">{interpolate(labels.pageLabel, { page, totalPages })}</p>
    </nav>
  );
}
