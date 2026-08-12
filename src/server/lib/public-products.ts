import "server-only";
import { unstable_cache } from "next/cache";
import { and, asc, desc, eq, exists, ilike, inArray, notInArray, or, sql } from "drizzle-orm";
import { getPublicUrl } from "@/core/storage/r2";
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

/**
 * Escapa os metacaracteres do LIKE/ILIKE (`\`, `%`, `_`) para que o termo do
 * usuário seja tratado como literal — sem isso, `%a%b%c%` multiplica o custo
 * do scan e `_` vira curinga de um caractere (achado da revisão de segurança).
 */
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export interface PublicProductListParams {
  category?: string;
  search?: string;
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
        isDefault: productPackagings.isDefault,
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

  const packagingsByProduct = new Map<
    string,
    { packagingType: string; unitsPerPack: number; isDefault: boolean }[]
  >();
  for (const row of packagingRows) {
    const list = packagingsByProduct.get(row.productId) ?? [];
    list.push({ packagingType: row.packagingType, unitsPerPack: row.unitsPerPack, isDefault: row.isDefault });
    packagingsByProduct.set(row.productId, list);
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

  if (search) {
    // `nameEn` incluído: no locale EN o card exibe nameEn — o usuário precisa
    // conseguir buscar exatamente o nome que vê na tela (achado da revisão).
    const term = `%${escapeLikePattern(search)}%`;
    conditions.push(
      or(ilike(products.sku, term), ilike(products.namePt, term), ilike(products.nameEn, term))!
    );
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

/**
 * Catálogo público (`GET /api/products` + SSR de `/produtos`).
 *
 * Navegação por categoria/página usa `unstable_cache` (tag `"products"`,
 * invalidada pelas mutações do tRPC e pelo sync do ERP): o espaço de chaves é
 * limitado (categorias × páginas). Busca livre NÃO é cacheada — a chave viria
 * do input do usuário, e cada termo único gravaria uma entrada nova no data
 * cache em disco, crescimento não limitado que um atacante controla (achado
 * da revisão de segurança). O termo também é truncado em MAX_SEARCH_LENGTH.
 */
export async function getPublicProductList(params: PublicProductListParams) {
  const search = params.search?.trim().slice(0, MAX_SEARCH_LENGTH) || undefined;
  const normalized: PublicProductListParams = { ...params, search };
  return search ? queryPublicProductList(normalized) : getCachedProductList(normalized);
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
 * Produtos em destaque para a seção "produtos em destaque" da home —
 * prioriza quem tem o badge `"top"` (mais recentes primeiro) e, se não
 * houver o suficiente, completa com os produtos publicados mais recentes,
 * sem repetir nenhum já escolhido.
 */
export const getFeaturedProducts = unstable_cache(
  async (limit = 8) => {
    const baseConditions = [eq(products.published, true), eq(products.active, true)];

    const topRows = await db
      .select()
      .from(products)
      .where(
        and(
          ...baseConditions,
          exists(
            db
              .select({ one: sql`1` })
              .from(productBadges)
              .where(and(eq(productBadges.productId, products.id), eq(productBadges.badge, "top")))
          )
        )
      )
      .orderBy(desc(products.createdAt))
      .limit(limit);

    const remaining = limit - topRows.length;
    let fillRows: (typeof products.$inferSelect)[] = [];

    if (remaining > 0) {
      const excludeIds = topRows.map((row) => row.id);
      fillRows = await db
        .select()
        .from(products)
        .where(
          and(...baseConditions, excludeIds.length > 0 ? notInArray(products.id, excludeIds) : undefined)
        )
        .orderBy(desc(products.createdAt))
        .limit(remaining);
    }

    return assembleProducts([...topRows, ...fillRows]);
  },
  ["public-featured-products"],
  { tags: ["products"], revalidate: 300 }
);
