"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Loader2, SlidersHorizontal, Trophy, X } from "lucide-react";
import { cn } from "@/core/lib/utils";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import {
  buildListingQuery,
  commitSearchTerm,
  effectiveSearchTerms,
  matchesServerRender,
  readListingState,
  sameList,
  toggleCategory,
  type ListingFilters,
  type ListingState,
} from "@/modules/products/lib/listing-filters";
import { buildPaginationRange } from "@/modules/products/lib/pagination";
import { rememberListingUrl } from "@/modules/products/lib/listing-memory";
import type { PublicCategory, PublicProductItem } from "@/modules/products/lib/types";
import { ProductCard, type ProductCardContent } from "@/shared/components/product-card";
import { interpolate } from "@/shared/lib/interpolate";
import { FilterChip } from "./filter-chip";
import { categoryDisplayName, ProductsFilters } from "./products-filters";
import { SearchTermsField } from "./search-terms-field";

const DEBOUNCE_MS = 350;
/** URLs escritas por este componente que aguardam o eco do roteador (teto da fila). */
const MAX_OWN_URLS = 10;

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
  /** Filtros da URL já validados pelo servidor (categorias existentes, termos normalizados). */
  initialFilters: ListingFilters;
  content: Dictionary["products"]["listing"];
  cardContent: ProductCardContent;
  badgeLabels: Dictionary["products"]["badges"];
  cartLabels: Dictionary["cart"]["addButton"];
};

/**
 * Estado dos filtros. `terms` são os termos FIXADOS (chips); `draft` é o texto
 * ainda no campo, que já filtra ao vivo como mais um termo.
 */
type ExplorerFilters = {
  terms: string[];
  draft: string;
  categories: string[];
  bestSeller: boolean;
  page: number;
};

/** Querystring de um estado: a da URL da página ou, com `perPage`, a da API. */
function toQuery(filters: ExplorerFilters, perPage?: number): URLSearchParams {
  return buildListingQuery({
    searchTerms: effectiveSearchTerms(filters.terms, filters.draft),
    categories: filters.categories,
    bestSeller: filters.bestSeller,
    page: filters.page,
    perPage,
  });
}

function toExplorer(state: ListingState): ExplorerFilters {
  return {
    terms: state.searchTerms,
    draft: "",
    categories: state.categories,
    bestSeller: state.bestSeller,
    page: state.page,
  };
}

/** Leitura da URL: o estado a exibir e se os itens renderizados pelo servidor servem para ele. */
type UrlSync = { state: ExplorerFilters; matchesServer: boolean };

/** Os dois estados pedem a MESMA consulta (ex.: o termo só passou do campo para um chip)? */
function sameQuery(a: ExplorerFilters, b: ExplorerFilters): boolean {
  return (
    sameList(effectiveSearchTerms(a.terms, a.draft), effectiveSearchTerms(b.terms, b.draft)) &&
    sameList(a.categories, b.categories) &&
    a.bestSeller === b.bestSeller &&
    a.page === b.page
  );
}

/**
 * Explorador do catálogo (spec 001, RF14/RF25): barra lateral de filtros no
 * desktop, gaveta no mobile, chips dos filtros ativos, faixa "Mostrando X–Y
 * de Z" e paginação numerada com setas.
 *
 * Filtros COMBINADOS (pedido do stakeholder, 2026-09-30 — regras em
 * `listing-filters`): várias categorias ao mesmo tempo (produtos de qualquer
 * uma delas) e vários termos de busca — Enter fixa o termo como chip e libera
 * o campo; cada termo novo refina o resultado. Na gaveta do mobile marcar uma
 * categoria NÃO fecha a gaveta: dá para marcar várias e ver o total no botão
 * "Ver N produtos".
 *
 * Primeira página vem renderizada do servidor; a partir daí toda mudança usa
 * `GET /api/products` no cliente. URL sincronizada com `history.replaceState`
 * (integração nativa do App Router: atualiza `useSearchParams` SEM refetch RSC
 * — `router.replace` aqui re-executaria a consulta no servidor a cada tecla).
 *
 * A URL é a FONTE DA VERDADE dos filtros (lida por `useSearchParams`, com as
 * mesmas regras do SSR). As props dizem o que o servidor renderizou — e em
 * voltar/avançar o roteador restaura a renderização em CACHE, anterior aos
 * filtros aplicados aqui. Por isso:
 * - na montagem, o estado vem da URL; se os itens do servidor não são dessa
 *   URL, busca os certos (voltar do detalhe mantinha a URL filtrada com a
 *   lista inteira na tela);
 * - toda URL que o explorador escreve entra numa fila e o eco dela é
 *   ignorado; qualquer OUTRA mudança de URL é navegação externa (menu
 *   "Produtos", busca do header, voltar/avançar) e é adotada — clicar em
 *   "Produtos" com filtros aplicados mantinha a lista filtrada numa URL limpa.
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
  const searchParams = useSearchParams();
  const resultsRef = useRef<HTMLDivElement | null>(null);

  const categoryOrder = categories.map((item) => item.slug);
  const urlKey = searchParams.toString();

  /** Lê a URL atual e confere se os itens renderizados pelo servidor são dela. */
  function readUrl(): UrlSync {
    const url = readListingState(searchParams, categoryOrder);
    const server: ListingState = { ...initialFilters, page: initialPage };
    const serverTotalPages = Math.max(1, Math.ceil(initialTotal / perPage));
    return matchesServerRender(url, server, serverTotalPages)
      ? { state: toExplorer({ ...url, page: initialPage }), matchesServer: true }
      : { state: toExplorer(url), matchesServer: false };
  }

  const [boot] = useState(readUrl);
  const [terms, setTerms] = useState(boot.state.terms);
  const [draft, setDraft] = useState("");
  const [selectedCategories, setSelectedCategories] = useState(boot.state.categories);
  const [bestSeller, setBestSeller] = useState(boot.state.bestSeller);
  const [page, setPage] = useState(boot.state.page);
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(!boot.matchesServer);
  const [loadError, setLoadError] = useState(false);
  const [termLimitHit, setTermLimitHit] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Sincronização com a URL. `urlSync`: a última adoção da URL (montagem ou
  // navegação externa), que o efeito mais abaixo conclui. `seenUrlKey`: a
  // última URL observada. `ownUrls`: as URLs que ESTE componente escreveu com
  // `replaceState` e cujo eco o roteador ainda não devolveu.
  const [urlSync, setUrlSync] = useState(boot);
  const [seenUrlKey, setSeenUrlKey] = useState(urlKey);
  const [ownUrls, setOwnUrls] = useState<string[]>([]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const inFlightRef = useRef(false);
  // Estado cujos itens estão na tela — usado para reverter estado e URL
  // quando um fetch falha, e para saber se uma mudança altera a consulta de
  // fato (senão não há por que buscar de novo).
  const lastGoodRef = useRef<ExplorerFilters>(
    boot.matchesServer ? boot.state : toExplorer({ ...initialFilters, page: initialPage })
  );

  if (urlKey !== seenUrlKey) {
    setSeenUrlKey(urlKey);
    const ownIndex = ownUrls.indexOf(urlKey);
    if (ownIndex >= 0) {
      // Eco de uma escrita nossa (`syncUrl`): o estado já é esse.
      setOwnUrls(ownUrls.slice(ownIndex + 1));
    } else {
      // Navegação externa (menu "Produtos", busca do header, voltar/avançar):
      // a URL manda — e os itens do servidor só valem se forem dela.
      const next = readUrl();
      setOwnUrls([]);
      setUrlSync(next);
      setTerms(next.state.terms);
      setDraft("");
      setSelectedCategories(next.state.categories);
      setBestSeller(next.state.bestSeller);
      setPage(next.state.page);
      setTermLimitHit(false);
      setLoadError(false);
      setLoading(!next.matchesServer);
      if (next.matchesServer) {
        setItems(initialItems);
        setTotal(initialTotal);
      }
    }
  }

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
      const queryString = toQuery(next).toString();
      const url = queryString ? `${pathname}?${queryString}` : pathname;
      rememberListingUrl(url);
      // URL igual à atual: o roteador não devolve eco — nada a registrar.
      if (queryString === window.location.search.slice(1)) return;
      // Registrada ANTES do replaceState, para o eco que o roteador devolve em
      // `useSearchParams` ser reconhecido como nosso (não como navegação).
      setOwnUrls((current) => [...current.slice(-(MAX_OWN_URLS - 1)), queryString]);
      window.history.replaceState(null, "", url);
    },
    [pathname]
  );

  /**
   * Busca os itens de `next`. Quem chama marca `loading`/`loadError` antes
   * (aqui só há atualização de estado DEPOIS da resposta — dá para chamar de
   * dentro de um efeito).
   */
  const loadProducts = useCallback(
    async (next: ExplorerFilters) => {
      const requestId = ++requestIdRef.current;
      inFlightRef.current = true;

      try {
        const response = await fetch(`/api/products?${toQuery(next, perPage).toString()}`);
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
        setTerms(prev.terms);
        setDraft(prev.draft);
        setSelectedCategories(prev.categories);
        setBestSeller(prev.bestSeller);
        setPage(prev.page);
        syncUrl(prev);
        setLoadError(true);
      } finally {
        if (requestId === requestIdRef.current) {
          inFlightRef.current = false;
          setLoading(false);
        }
      }
    },
    [perPage, syncUrl]
  );

  useEffect(() => {
    // Conclui a adoção da URL (montagem ou navegação externa): invalida fetch
    // em voo e debounce pendente e, se os itens do servidor não são dessa
    // URL, busca os certos.
    requestIdRef.current += 1;
    inFlightRef.current = false;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (urlSync.matchesServer) {
      lastGoodRef.current = urlSync.state;
      return;
    }
    // A busca sai do corpo do efeito (tarefa seguinte): a limpeza a cancela se
    // outra adoção chegar antes — e no StrictMode sai uma requisição só.
    const timer = setTimeout(() => void loadProducts(urlSync.state), 0);
    return () => clearTimeout(timer);
  }, [urlSync, loadProducts]);

  const current = (): ExplorerFilters => ({
    terms,
    draft,
    categories: selectedCategories,
    bestSeller,
    page,
  });

  function apply(next: ExplorerFilters) {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setTerms(next.terms);
    setDraft(next.draft);
    setSelectedCategories(next.categories);
    setBestSeller(next.bestSeller);
    setPage(next.page);
    setLoading(true);
    setLoadError(false);
    syncUrl(next);
    void loadProducts(next);
  }

  /** Nada pendente nem em voo: o que está na tela é exatamente `lastGoodRef`. */
  const settled = () => !debounceRef.current && !inFlightRef.current;

  const handleDraftChange = (value: string) => {
    setDraft(value);
    setTermLimitHit(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const next: ExplorerFilters = { ...current(), draft: value, page: 1 };
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      // Só espaço a mais, ou o mesmo texto de um chip: a consulta não muda.
      const last = lastGoodRef.current;
      if (!inFlightRef.current && sameQuery({ ...next, page: last.page }, last)) return;
      setPage(1);
      setLoading(true);
      setLoadError(false);
      syncUrl(next);
      void loadProducts(next);
    }, DEBOUNCE_MS);
  };

  /** Enter (ou "+"): o texto do campo vira um chip e o campo fica livre para o próximo termo. */
  const handleCommitDraft = () => {
    const result = commitSearchTerm(terms, draft);
    if (result.status === "empty") return;
    if (result.status === "limit") {
      setTermLimitHit(true);
      return;
    }
    setTermLimitHit(false);
    const next: ExplorerFilters = { ...current(), terms: result.terms, draft: "" };
    // O texto já filtrava ao vivo: se a consulta é a que está na tela, o termo
    // só muda de lugar — sem nova requisição e sem voltar à página 1.
    if (settled() && sameQuery(next, lastGoodRef.current)) {
      setTerms(next.terms);
      setDraft("");
      lastGoodRef.current = next;
      return;
    }
    apply({ ...next, page: 1 });
  };

  const handleRemoveTerm = (term: string) => {
    setTermLimitHit(false);
    apply({ ...current(), terms: terms.filter((item) => item !== term), page: 1 });
  };

  const handleToggleCategory = (slug: string) =>
    apply({ ...current(), categories: toggleCategory(selectedCategories, slug, categoryOrder), page: 1 });
  const handleClearCategories = () => {
    if (selectedCategories.length > 0) apply({ ...current(), categories: [], page: 1 });
  };
  const handleBestSellerChange = (value: boolean) => apply({ ...current(), bestSeller: value, page: 1 });
  const handleClear = () => {
    setTermLimitHit(false);
    apply({ terms: [], draft: "", categories: [], bestSeller: false, page: 1 });
  };

  const handlePageChange = (nextPage: number) => {
    apply({ ...current(), page: nextPage });
    // Volta ao topo dos RESULTADOS (não da página): o header é fixo, então o
    // alvo compensa a altura dele via `scroll-margin` do contêiner.
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    resultsRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  };

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  const activeTerms = effectiveSearchTerms(terms, draft);
  const selectedCategoryItems = categories.filter((item) => selectedCategories.includes(item.slug));
  // Badge do botão "Filtros" (mobile): só o que mora DENTRO da gaveta.
  const drawerFilterCount = selectedCategories.length + (bestSeller ? 1 : 0);
  const chipCount = terms.length + selectedCategoryItems.length + (bestSeller ? 1 : 0);
  const hasAnyFilter = activeTerms.length > 0 || selectedCategories.length > 0 || bestSeller;

  const filtersProps = {
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
    onDraftChange: handleDraftChange,
    onCommitDraft: handleCommitDraft,
    onRemoveTerm: handleRemoveTerm,
    onToggleCategory: handleToggleCategory,
    onClearCategories: handleClearCategories,
    onBestSellerChange: handleBestSellerChange,
    onClear: handleClear,
  };

  return (
    <div className="relative mx-auto max-w-7xl px-5 pb-20 sm:px-6">
      <div className="lg:grid lg:grid-cols-[19rem_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[20rem_minmax(0,1fr)] xl:gap-10">
        {/* Barra lateral (desktop). Rola por dentro quando é mais alta que a
            tela — senão, fixa (sticky), o fim dela ficaria inalcançável. */}
        <aside aria-label={content.filtersTitle} className="hidden lg:block">
          <div className="sticky top-28 max-h-[calc(100dvh-8rem)] overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-white/[0.02] p-5 [scrollbar-width:thin]">
            <h2 className="mb-5 font-display text-h2 text-white">{content.filtersTitle}</h2>
            <ProductsFilters {...filtersProps} />
          </div>
        </aside>

        <div ref={resultsRef} className="scroll-mt-28">
          {/* Barra do mobile: busca sempre à vista + botão da gaveta de filtros. */}
          <div className="flex items-start gap-3 lg:hidden">
            <SearchTermsField
              variant="bar"
              className="min-w-0 flex-1"
              content={content}
              value={draft}
              terms={terms}
              limitHit={termLimitHit}
              onChange={handleDraftChange}
              onCommit={handleCommitDraft}
              onRemoveTerm={handleRemoveTerm}
            />
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-expanded={drawerOpen}
              className="relative inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-meta font-semibold text-white transition hover:border-neon-cyan/50"
            >
              <SlidersHorizontal className="size-4" aria-hidden />
              {content.openFilters}
              {drawerFilterCount > 0 ? (
                <span className="flex size-5 items-center justify-center rounded-full bg-neon-cyan-bright text-micro font-bold text-background">
                  {drawerFilterCount}
                </span>
              ) : null}
            </button>
          </div>

          {/* Faixa de resultado + chips de TODOS os filtros ativos. */}
          <div className="mt-5 flex flex-col gap-3 lg:mt-0">
            <p className="flex items-center gap-2 text-meta text-white/60" aria-live="polite">
              {loading ? <Loader2 className="size-4 animate-spin text-neon-cyan-bright" aria-hidden /> : null}
              {total > 0
                ? interpolate(content.resultsRange, { from, to, total })
                : interpolate(content.resultsCount, { count: total })}
            </p>

            {chipCount > 0 ? (
              <ul className="flex flex-wrap items-center gap-2" aria-label={content.activeFilters}>
                {terms.map((term) => (
                  <FilterChip
                    key={`search:${term}`}
                    label={interpolate(content.searchChip, { term })}
                    removeLabel={interpolate(content.removeFilter, { label: term })}
                    onRemove={() => handleRemoveTerm(term)}
                  />
                ))}
                {selectedCategoryItems.map((item) => {
                  const name = categoryDisplayName(item, locale);
                  return (
                    <FilterChip
                      key={`category:${item.slug}`}
                      label={name}
                      removeLabel={interpolate(content.removeFilter, { label: name })}
                      onRemove={() => handleToggleCategory(item.slug)}
                    />
                  );
                })}
                {bestSeller ? (
                  <FilterChip
                    tone="amber"
                    icon={<Trophy className="size-3.5" aria-hidden />}
                    label={content.bestSellerFilter}
                    removeLabel={interpolate(content.removeFilter, { label: content.bestSellerFilter })}
                    onRemove={() => handleBestSellerChange(false)}
                  />
                ) : null}
                {chipCount > 1 ? (
                  <li>
                    <button
                      type="button"
                      onClick={handleClear}
                      className="rounded-full px-2.5 py-1 text-micro font-semibold text-white/60 underline-offset-4 transition hover:text-white hover:underline"
                    >
                      {content.clearFilters}
                    </button>
                  </li>
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
              <p className="text-body text-white/70">
                {activeTerms.length > 1 ? content.emptyStateAllTerms : content.emptyState}
              </p>
              {hasAnyFilter ? (
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
