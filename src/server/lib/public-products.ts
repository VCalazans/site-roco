import "server-only";
import { unstable_cache } from "next/cache";
import { and, asc, desc, eq, exists, gt, inArray, lt, sql } from "drizzle-orm";
import { getPublicUrl } from "@/core/storage/r2";
import { matchAllTerms } from "@/server/lib/sql-like";
import { sortPackagings } from "@/shared/lib/packaging";
import { db } from "@/db";
import {
  categories,
  productBadges,
  productCategories,
  productImages,
  productPackagings,
  products,
} from "@/db/schema";

const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;
/** Teto do termo de busca — limita o custo do ILIKE com input do usuário. */
const MAX_SEARCH_LENGTH = 80;


export interface PublicProductListParams {
  category?: string;
  search?: string;
  /** Só campeões de vendas (filtro da barra lateral, spec 001 RF25). */
  bestSeller?: boolean;
  page?: number;
  perPage?: number;
}

function safePublicUrl(key: string): string | null {
  try {
    return getPublicUrl(key);
  } catch {
    return null;
  }
}

function normalizePagination(page?: number, perPage?: number) {
  const safePage = Number.isFinite(page) && (page as number) > 0 ? Math.floor(page as number) : 1;
  const safePerPage =
    Number.isFinite(perPage) && (perPage as number) > 0
      ? Math.min(Math.floor(perPage as number), MAX_PER_PAGE)
      : DEFAULT_PER_PAGE;
  return { page: safePage, perPage: safePerPage };
}

async function assembleProducts(productRows: (typeof products.$inferSelect)[]) {
  const productIds = productRows.map((row) => row.id);
  if (productIds.length === 0) return [];

  const [categoryRows, badgeRows, packagingRows, imageRows] = await Promise.all([
    db
      .select({
        productId: productCategories.productId,
        slug: categories.slug,
        namePt: categories.namePt,
        nameEn: categories.nameEn,
      })
      .from(productCategories)
      .innerJoin(categories, eq(categories.id, productCategories.categoryId))
      .where(inArray(productCategories.productId, productIds)),
    db
      .select({ productId: productBadges.productId, badge: productBadges.badge })
      .from(productBadges)
      .where(inArray(productBadges.productId, productIds)),
    db
      .select({
        productId: productPackagings.productId,
        packagingType: productPackagings.packagingType,
        unitsPerPack: productPackagings.unitsPerPack,
        barcodeEan13: productPackagings.barcodeEan13,
      })
      .from(productPackagings)
      .where(inArray(productPackagings.productId, productIds)),
    db
      .select({
        productId: productImages.productId,
        r2Key: productImages.r2Key,
        altPt: productImages.altPt,
        altEn: productImages.altEn,
      })
      .from(productImages)
      .where(inArray(productImages.productId, productIds))
      .orderBy(asc(productImages.sortOrder)),
  ]);

  const categoriesByProduct = new Map<
    string,
    { slug: string; namePt: string; nameEn: string | null }[]
  >();
  for (const row of categoryRows) {
    const list = categoriesByProduct.get(row.productId) ?? [];
    list.push({ slug: row.slug, namePt: row.namePt, nameEn: row.nameEn });
    categoriesByProduct.set(row.productId, list);
  }

  const badgesByProduct = new Map<string, string[]>();
  for (const row of badgeRows) {
    const list = badgesByProduct.get(row.productId) ?? [];
    list.push(row.badge);
    badgesByProduct.set(row.productId, list);
  }

  // TODAS as embalagens do produto, em ordem estável (tipo → quantidade) e sem
  // `isDefault`: a embalagem pode ser composta e nenhuma é a "padrão" (regra do
  // negócio — ver `@/shared/lib/packaging`). O EAN da embalagem vai junto:
  // algumas variantes têm código de barras próprio.
  const packagingsByProduct = new Map<
    string,
    { packagingType: string; unitsPerPack: number; barcodeEan13: string | null }[]
  >();
  for (const row of packagingRows) {
    const list = packagingsByProduct.get(row.productId) ?? [];
    list.push({ packagingType: row.packagingType, unitsPerPack: row.unitsPerPack, barcodeEan13: row.barcodeEan13 });
    packagingsByProduct.set(row.productId, list);
  }
  for (const [productId, list] of packagingsByProduct) {
    packagingsByProduct.set(productId, sortPackagings(list));
  }

  // altPt/altEn serializados separadamente — quem escolhe é o componente,
  // conforme o locale da página (mesmo padrão de namePt/nameEn). Colapsar em
  // um único `alt` aqui faria páginas EN emitirem alt em português (achado da
  // revisão), já que estas funções são cacheadas sem locale na chave.
  const imagesByProduct = new Map<
    string,
    { url: string; altPt: string | null; altEn: string | null }[]
  >();
  for (const row of imageRows) {
    const url = safePublicUrl(row.r2Key);
    if (!url) continue;
    const list = imagesByProduct.get(row.productId) ?? [];
    list.push({ url, altPt: row.altPt, altEn: row.altEn });
    imagesByProduct.set(row.productId, list);
  }

  return productRows.map((product) => ({
    sku: product.sku,
    slug: product.slug,
    namePt: product.namePt,
    nameEn: product.nameEn,
    descriptionPt: product.descriptionPt,
    descriptionEn: product.descriptionEn,
    /** "Campeão de vendas" — selo com troféu no card/detalhe (spec 001, RF08). */
    bestSeller: product.bestSeller,
    featured: product.featured,
    categories: categoriesByProduct.get(product.id) ?? [],
    badges: badgesByProduct.get(product.id) ?? [],
    packagings: packagingsByProduct.get(product.id) ?? [],
    images: imagesByProduct.get(product.id) ?? [],
  }));
}

/**
 * Corpo da consulta do catálogo público — somente `published && active`.
 * NÃO exportado cru: o export decide entre a versão cacheada e a direta
 * (ver `getPublicProductList`).
 */
async function queryPublicProductList(params: PublicProductListParams) {
  const { page, perPage } = normalizePagination(params.page, params.perPage);
  const search = params.search?.trim();
  const categorySlug = params.category?.trim();

  const conditions = [eq(products.published, true), eq(products.active, true)];

  if (params.bestSeller) {
    conditions.push(eq(products.bestSeller, true));
  }

  if (search) {
    // Todas as palavras, em qualquer ordem, sem ligar para acento/caixa
    // ("flexivel gas" acha "FLEXÍVEL PARA GÁS"). `nameEn` incluído: no locale
    // EN o card exibe nameEn — o usuário precisa achar o nome que vê na tela.
    const match = matchAllTerms(search, [products.sku, products.namePt, products.nameEn]);
    if (match) conditions.push(match);
  }

  if (categorySlug) {
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(productCategories)
          .innerJoin(categories, eq(categories.id, productCategories.categoryId))
          .where(and(eq(productCategories.productId, products.id), eq(categories.slug, categorySlug)))
      )
    );
  }

  const whereClause = and(...conditions);

  // count antes do select: a página pedida é CLAMPADA ao intervalo real
  // (?page=999 com 37 páginas devolve a página 37, não um grid vazio com
  // "Página 999 de 37" — achado da revisão). Custo: as duas queries deixam
  // de rodar em paralelo; irrelevante perto do round-trip da página.
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(products)
    .where(whereClause);

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, totalPages);

  const rows =
    total === 0
      ? []
      : await db
          .select()
          .from(products)
          .where(whereClause)
          .orderBy(asc(products.sku))
          .limit(perPage)
          .offset((safePage - 1) * perPage);

  const items = await assembleProducts(rows);

  return { items, total, page: safePage, perPage };
}

const getCachedProductList = unstable_cache(queryPublicProductList, ["public-product-list"], {
  tags: ["products"],
  revalidate: 300,
});

/** Última página que entra na CHAVE do cache: 200 × 20 = 4.000 produtos (o catálogo tem ~740). */
const MAX_CACHED_PAGE = 200;
/** Tamanhos de página que a própria UI pede (listagem e contagens) — só eles são cacheados. */
const CACHEABLE_PER_PAGE: ReadonlySet<number> = new Set([DEFAULT_PER_PAGE, 1]);

/**
 * Catálogo público (`GET /api/products` + SSR de `/produtos`).
 *
 * A chave do `unstable_cache` (tag `"products"`, invalidada pelas mutações do
 * tRPC e pelo sync do ERP) vem da querystring, então o ESPAÇO de chaves é
 * fechado aqui — senão cada valor inventado grava uma entrada nova no data
 * cache em disco, crescimento que quem faz a requisição controla (revisões de
 * segurança de 2026-08-12 e 2026-09-30):
 * - categoria: só slug que EXISTE (lista cacheada); desconhecida devolve lista
 *   vazia sem tocar cache nem banco (e `%00` deixa de virar 500);
 * - página e tamanho: fora de `MAX_CACHED_PAGE`/`CACHEABLE_PER_PAGE` a consulta
 *   roda direto, sem cache — funciona, só não ocupa disco;
 * - busca livre: nunca cacheada (e truncada em MAX_SEARCH_LENGTH).
 */
export async function getPublicProductList(params: PublicProductListParams) {
  const search = params.search?.trim().slice(0, MAX_SEARCH_LENGTH) || undefined;
  const category = params.category?.trim() || undefined;
  const { page, perPage } = normalizePagination(params.page, params.perPage);

  if (category) {
    const knownCategories = await getPublicCategoryList();
    if (!knownCategories.some((item) => item.slug === category)) {
      return { items: [], total: 0, page: 1, perPage };
    }
  }

  // Montado campo a campo: nada além do contrato entra na chave. E
  // `bestSeller: false` vira `undefined` — o mesmo filtro, uma entrada só.
  const normalized: PublicProductListParams = {
    category,
    search,
    bestSeller: params.bestSeller || undefined,
    page,
    perPage,
  };
  const cacheable = !search && page <= MAX_CACHED_PAGE && CACHEABLE_PER_PAGE.has(perPage);
  return cacheable ? getCachedProductList(normalized) : queryPublicProductList(normalized);
}

/** Detalhe público por slug (`GET /api/products/[slug]`) — somente `published && active`. */
export const getPublicProductBySlug = unstable_cache(
  async (slug: string) => {
    const [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.slug, slug), eq(products.published, true), eq(products.active, true)))
      .limit(1);

    if (!product) return null;

    const [assembled] = await assembleProducts([product]);
    return assembled ?? null;
  },
  ["public-product-detail"],
  { tags: ["products"], revalidate: 300 }
);

/**
 * Detalhe público de VÁRIOS produtos por slug (`subject: "cart"` em
 * `POST /api/contact` — resolve todos os itens do carrinho numa query só).
 * Mesmos filtros de `getPublicProductBySlug` (`published && active`).
 * Produtos não encontrados (slug expirado, despublicado, inventado) apenas
 * NÃO aparecem no retorno — quem chama decide o que fazer com o que faltou
 * (ex.: descartar do carrinho antes de gravar o lead).
 *
 * NÃO CACHEADA de propósito: o input é um array arbitrário de slugs montado
 * pelo cliente (o carrinho é dele, não um filtro fixo como categoria/página).
 * Cachear por essa chave cresceria o espaço do data cache em disco sem
 * limite, controlado por quem monta a requisição — mesmo raciocínio já
 * aplicado à busca livre de `getPublicProductList` acima.
 */
export async function getPublicProductsBySlugs(slugs: string[]) {
  const uniqueSlugs = [...new Set(slugs.map((slug) => slug.trim()).filter(Boolean))];
  if (uniqueSlugs.length === 0) return [];

  const rows = await db
    .select()
    .from(products)
    .where(
      and(
        inArray(products.slug, uniqueSlugs),
        eq(products.published, true),
        eq(products.active, true)
      )
    );

  return assembleProducts(rows);
}

/**
 * Categorias ativas para os filtros da listagem pública. Chamada direto pelo
 * Server Component (sem passar por HTTP — módulo `server-only`), então não
 * ganha rota REST própria. Mesma tag `"products"` para invalidar junto do
 * catálogo (uma categoria pode mudar de nome/ordem nas mutações do tRPC).
 */
export const getPublicCategoryList = unstable_cache(
  async () => {
    const rows = await db
      .select({
        slug: categories.slug,
        namePt: categories.namePt,
        nameEn: categories.nameEn,
        parentId: categories.parentId,
      })
      .from(categories)
      .where(eq(categories.active, true))
      .orderBy(asc(categories.sortOrder), asc(categories.namePt));

    return rows;
  },
  ["public-category-list"],
  { tags: ["products"], revalidate: 300 }
);

/**
 * Vitrine "Produtos em destaque" da home (spec 001, RF06/RF07).
 *
 * 1. Produtos com a flag `featured`, na ordem definida pelo operador
 *    (`featured_order`, depois SKU). Curadoria explícita NÃO é completada com
 *    outros produtos — a vitrine mostra exatamente o que foi escolhido.
 * 2. Nenhum destaque publicado → campeões de vendas (mais recentes primeiro).
 * 3. Nem isso → os publicados mais recentes. A home nunca fica sem vitrine.
 */
export const getFeaturedProducts = unstable_cache(
  async (limit = 8) => {
    const safeLimit = Math.min(Math.max(Math.floor(limit) || 8, 1), 24);
    const baseConditions = [eq(products.published, true), eq(products.active, true)];

    const featuredRows = await db
      .select()
      .from(products)
      .where(and(...baseConditions, eq(products.featured, true)))
      .orderBy(asc(products.featuredOrder), asc(products.sku))
      .limit(safeLimit);
    if (featuredRows.length > 0) return assembleProducts(featuredRows);

    const bestSellerRows = await db
      .select()
      .from(products)
      .where(and(...baseConditions, eq(products.bestSeller, true)))
      .orderBy(desc(products.createdAt), asc(products.sku))
      .limit(safeLimit);
    if (bestSellerRows.length > 0) return assembleProducts(bestSellerRows);

    const newestRows = await db
      .select()
      .from(products)
      .where(and(...baseConditions))
      .orderBy(desc(products.createdAt), asc(products.sku))
      .limit(safeLimit);
    return assembleProducts(newestRows);
  },
  ["public-featured-products-v2"],
  { tags: ["products"], revalidate: 300 }
);

/**
 * Quantos produtos PUBLICADOS cada categoria tem — contagem da barra lateral
 * da listagem (spec 001, RF25). Uma query agrupada, cacheada com o catálogo.
 */
export const getPublicCategoryCounts = unstable_cache(
  async (): Promise<Record<string, number>> => {
    const rows = await db
      .select({
        slug: categories.slug,
        total: sql<number>`count(distinct ${productCategories.productId})::int`,
      })
      .from(productCategories)
      .innerJoin(categories, eq(categories.id, productCategories.categoryId))
      .innerJoin(products, eq(products.id, productCategories.productId))
      .where(and(eq(products.published, true), eq(products.active, true), eq(categories.active, true)))
      .groupBy(categories.slug);

    return Object.fromEntries(rows.map((row) => [row.slug, row.total]));
  },
  ["public-category-counts"],
  { tags: ["products"], revalidate: 300 }
);

/** Total de campeões de vendas publicados (rótulo do filtro lateral). */
export const getPublicBestSellerCount = unstable_cache(
  async (): Promise<number> => {
    const [row] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(products)
      .where(and(eq(products.published, true), eq(products.active, true), eq(products.bestSeller, true)));
    return row?.total ?? 0;
  },
  ["public-best-seller-count"],
  { tags: ["products"], revalidate: 300 }
);

/**
 * Produto anterior/próximo dentro da MESMA categoria, na ordem da listagem
 * (SKU crescente) — setas do detalhe do produto (spec 001, RF13). Sem
 * categoria, navega pelo catálogo inteiro. Cacheado: o espaço de chaves é
 * limitado ao próprio catálogo (slug × categoria reais).
 */
export const getAdjacentProducts = unstable_cache(
  async (sku: string, categorySlug: string | null) => {
    const conditions = [eq(products.published, true), eq(products.active, true)];
    if (categorySlug) {
      conditions.push(
        exists(
          db
            .select({ one: sql`1` })
            .from(productCategories)
            .innerJoin(categories, eq(categories.id, productCategories.categoryId))
            .where(and(eq(productCategories.productId, products.id), eq(categories.slug, categorySlug)))
        )
      );
    }

    const [previousRows, nextRows] = await Promise.all([
      db
        .select()
        .from(products)
        .where(and(...conditions, lt(products.sku, sku)))
        .orderBy(desc(products.sku))
        .limit(1),
      db
        .select()
        .from(products)
        .where(and(...conditions, gt(products.sku, sku)))
        .orderBy(asc(products.sku))
        .limit(1),
    ]);

    const [previous] = await assembleProducts(previousRows);
    const [next] = await assembleProducts(nextRows);
    return { previous: previous ?? null, next: next ?? null };
  },
  ["public-adjacent-products"],
  { tags: ["products"], revalidate: 300 }
);
