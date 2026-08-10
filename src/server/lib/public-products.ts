import "server-only";
import { unstable_cache } from "next/cache";
import { and, asc, eq, exists, ilike, inArray, or, sql } from "drizzle-orm";
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

  const categoriesByProduct = new Map<string, { slug: string; namePt: string }[]>();
  for (const row of categoryRows) {
    const list = categoriesByProduct.get(row.productId) ?? [];
    list.push({ slug: row.slug, namePt: row.namePt });
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

  const imagesByProduct = new Map<string, { url: string; alt: string }[]>();
  for (const row of imageRows) {
    const url = safePublicUrl(row.r2Key);
    if (!url) continue;
    const list = imagesByProduct.get(row.productId) ?? [];
    list.push({ url, alt: row.altPt ?? row.altEn ?? "" });
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
 * Catálogo público (`GET /api/products`) — somente `published && active`.
 * Envolvido em `unstable_cache` com a tag `"products"`, invalidada pelas
 * mutações do router tRPC e pelo sync do ERP via `revalidateTag`.
 */
export const getPublicProductList = unstable_cache(
  async (params: PublicProductListParams) => {
    const { page, perPage } = normalizePagination(params.page, params.perPage);
    const search = params.search?.trim();
    const categorySlug = params.category?.trim();

    const conditions = [eq(products.published, true), eq(products.active, true)];

    if (search) {
      const term = `%${search}%`;
      conditions.push(or(ilike(products.sku, term), ilike(products.namePt, term))!);
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

    const [rows, [{ total }]] = await Promise.all([
      db
        .select()
        .from(products)
        .where(whereClause)
        .orderBy(asc(products.sku))
        .limit(perPage)
        .offset((page - 1) * perPage),
      db.select({ total: sql<number>`count(*)::int` }).from(products).where(whereClause),
    ]);

    const items = await assembleProducts(rows);

    return { items, total, page, perPage };
  },
  ["public-product-list"],
  { tags: ["products"], revalidate: 300 }
);

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
