"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { PublicCategory, PublicProductItem } from "@/modules/products/lib/types";
import { ProductCard } from "@/shared/components/product-card";

const DEBOUNCE_MS = 350;

type ProductsExplorerProps = {
  locale: Locale;
  initialItems: PublicProductItem[];
  initialTotal: number;
  initialPage: number;
  perPage: number;
  categories: PublicCategory[];
  initialFilters: { category: string; search: string };
  content: Dictionary["products"]["listing"];
  cardContent: Dictionary["products"]["card"];
  badgeLabels: Dictionary["products"]["badges"];
};

function categoryName(category: PublicCategory, locale: Locale): string {
  return locale === "en" && category.nameEn ? category.nameEn : category.namePt;
}

/**
 * Interpolate `{count}`/`{page}`/`{totalPages}` placeholders in dictionary
 * strings. Kept tiny on purpose — the dictionaries only ever use single,
 * non-nested placeholders here.
 */
function interpolate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
    template
  );
}

/**
 * Client-side catálogo explorer. Recebe a primeira página já renderizada no
 * server (via `getPublicProductList`, sem round-trip HTTP) e, a partir daí,
 * toda busca/filtro/paginação usa `GET /api/products` (client-side) —
 * mantendo a URL em sincronia (`router.replace`, shallow) para que o estado
 * filtrado seja compartilhável/recarregável.
 */
export function ProductsExplorer({
  locale,
  initialItems,
  initialTotal,
  initialPage,
  perPage,
  categories,
  initialFilters,
  content,
  cardContent,
  badgeLabels,
}: ProductsExplorerProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [search, setSearch] = useState(initialFilters.search);
  const [category, setCategory] = useState(initialFilters.category);
  const [page, setPage] = useState(initialPage);
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const fetchProducts = useCallback(
    async (next: { search: string; category: string; page: number }) => {
      const requestId = ++requestIdRef.current;
      setLoading(true);

      const qs = new URLSearchParams();
      if (next.search) qs.set("search", next.search);
      if (next.category) qs.set("category", next.category);
      qs.set("page", String(next.page));
      qs.set("perPage", String(perPage));

      try {
        const response = await fetch(`/api/products?${qs.toString()}`);
        if (!response.ok) throw new Error(`Unexpected status ${response.status}`);
        const data = (await response.json()) as { items: PublicProductItem[]; total: number };

        // Stale response guard: ignore results from a request that isn't the
        // most recent one (fast typing / fast clicks can resolve out of order).
        if (requestId !== requestIdRef.current) return;
        setItems(data.items);
        setTotal(data.total);
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        console.error("[ProductsExplorer] failed to fetch products", error);
        // Keep the previous results on screen — better than clearing the grid.
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    },
    [perPage]
  );

  const syncUrl = useCallback(
    (next: { search: string; category: string; page: number }) => {
      const qs = new URLSearchParams();
      if (next.search) qs.set("search", next.search);
      if (next.category) qs.set("category", next.category);
      if (next.page > 1) qs.set("page", String(next.page));
      const queryString = qs.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    },
    [pathname, router]
  );

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      syncUrl({ search: value, category, page: 1 });
      fetchProducts({ search: value, category, page: 1 });
    }, DEBOUNCE_MS);
  };

  const handleCategoryChange = (value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setCategory(value);
    setPage(1);
    syncUrl({ search, category: value, page: 1 });
    fetchProducts({ search, category: value, page: 1 });
  };

  const handlePageChange = (nextPage: number) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setPage(nextPage);
    syncUrl({ search, category, page: nextPage });
    fetchProducts({ search, category, page: nextPage });
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="relative mx-auto max-w-7xl px-5 pb-20 sm:px-6">
      {/* Filters */}
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center">
        <label className="relative flex flex-1 items-center">
          <Search className="pointer-events-none absolute left-3.5 size-4 text-white/40" aria-hidden />
          <span className="sr-only">{content.searchPlaceholder}</span>
          <input
            type="search"
            value={search}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder={content.searchPlaceholder}
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-body text-white placeholder:text-white/35 outline-none transition focus:border-neon-cyan focus:ring-2 focus:ring-neon-cyan/20"
          />
        </label>

        <label className="sm:w-64">
          <span className="sr-only">{content.categoryAllLabel}</span>
          <select
            value={category}
            onChange={(event) => handleCategoryChange(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-body text-white outline-none transition focus:border-neon-cyan focus:ring-2 focus:ring-neon-cyan/20"
          >
            <option value="" className="bg-[#0a0f16]">
              {content.categoryAllLabel}
            </option>
            {categories.map((cat) => (
              <option key={cat.slug} value={cat.slug} className="bg-[#0a0f16]">
                {cat.parentId ? `— ${categoryName(cat, locale)}` : categoryName(cat, locale)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Results count */}
      <div className="mt-6 flex items-center gap-2 text-meta text-white/60" aria-live="polite">
        {loading ? <Loader2 className="size-4 animate-spin text-neon-cyan-bright" aria-hidden /> : null}
        <span>{interpolate(content.resultsCount, { count: total })}</span>
      </div>

      {/* Grid */}
      {items.length === 0 && !loading ? (
        <p className="mt-12 text-center text-body text-white/60">{content.emptyState}</p>
      ) : (
        <div
          aria-busy={loading}
          className="mt-6 grid grid-cols-2 gap-4 transition-opacity sm:grid-cols-3 lg:grid-cols-4"
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
              priority={index < 4}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 ? (
        <nav
          aria-label={content.pagination.pageLabel}
          className="mt-10 flex items-center justify-center gap-4"
        >
          <button
            type="button"
            onClick={() => handlePageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            aria-label={content.pagination.previous}
            className="flex size-10 items-center justify-center rounded-full border border-white/10 text-white transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>

          <span aria-current="page" className="text-meta text-white/70">
            {interpolate(content.pagination.pageLabel, { page, totalPages })}
          </span>

          <button
            type="button"
            onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            aria-label={content.pagination.next}
            className="flex size-10 items-center justify-center rounded-full border border-white/10 text-white transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </nav>
      ) : null}
    </div>
  );
}
