import "server-only";
import { revalidateTag } from "next/cache";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { hasPermission } from "@/core/auth/rbac";
import { deleteObject, getPresignedUploadUrl, getPublicUrl, headObject } from "@/core/storage/r2";
import { db as dbClient } from "@/db";
import {
  categories,
  packagingTypeEnum,
  productBadgeEnum,
  productBadges,
  productCategories,
  productImages,
  productPackagings,
  products,
} from "@/db/schema";
import { DEFAULT_PORTAL_PER_PAGE, clampPage } from "@/modules/portal/lib/pagination";
import { moveToFront } from "@/modules/portal/lib/product-images";
import { writeAuditLog } from "@/server/lib/audit";
import { translateDbError } from "@/server/lib/db-error";
import {
  portalProductConditions,
  portalProductFiltersSchema,
  siteImageExists,
} from "@/server/lib/portal-product-filters";
import { checkRateLimit } from "@/server/lib/rate-limit";
import { slugify } from "@/server/lib/slugify";
import { sortPackagings } from "@/shared/lib/packaging";
import { permissionProcedure, router } from "../init";

/** Compartilhado com `representatives.presignDocumentUpload` — mesmo balde por usuário. */
const PRESIGN_RATE_LIMIT = { windowSeconds: 5 * 60, max: 30 };

type Database = typeof dbClient;
type PackagingTypeSlug = (typeof packagingTypeEnum.enumValues)[number];
type BadgeSlug = (typeof productBadgeEnum.enumValues)[number];

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const CONTENT_TYPE_EXTENSION: Record<(typeof ALLOWED_IMAGE_TYPES)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** URL pública tolerante a `R2_PUBLIC_URL` ausente (dev sem R2 configurado). */
function safePublicUrl(key: string): string | null {
  try {
    return getPublicUrl(key);
  } catch {
    return null;
  }
}

const packagingInputSchema = z.object({
  packagingType: z.enum(packagingTypeEnum.enumValues),
  unitsPerPack: z.number().int().positive(),
  erpComplementCode: z.string().trim().max(4).optional(),
  barcodeEan13: z.string().trim().max(13).optional(),
  isDefault: z.boolean().default(false),
});

/**
 * Texto opcional que o operador pode APAGAR no formulário: `null` limpa a
 * coluna; ausente (`undefined`) = "não mexer" no update / vazio no create.
 * Antes só existia o `undefined`, então esvaziar um campo no painel não
 * tinha efeito — o valor antigo voltava depois de salvar.
 */
const clearable = <T extends z.ZodString>(schema: T) => schema.nullable().optional();

const productMutableFields = {
  sku: z.string().trim().min(1).max(20),
  namePt: z.string().trim().min(1),
  slug: z.string().trim().min(1).max(220).optional(),
  erpCode: clearable(z.string().trim().max(20)),
  nameEn: clearable(z.string().trim().min(1)),
  descriptionPt: clearable(z.string().trim().min(1)),
  descriptionEn: clearable(z.string().trim().min(1)),
  ncm: clearable(z.string().trim().max(8)),
  barcodeEan13: clearable(z.string().trim().max(13)),
  /**
   * Publicar/despublicar exige `products:publish` também por aqui (não só no
   * `setPublished`): quem só tem create/update não pode pôr produto no ar
   * pelo formulário — ver a checagem em `create`/`update`.
   */
  published: z.boolean().optional(),
  /** Vitrine da home (spec 001). Ao ligar sem `featuredOrder`, entra no fim da fila. */
  featured: z.boolean().optional(),
  featuredOrder: z.number().int().min(0).max(100_000).optional(),
  /** "Campeão de vendas" — selo com troféu no site. */
  bestSeller: z.boolean().optional(),
  categoryIds: z.array(z.string().uuid()),
  primaryCategoryId: z.string().uuid().optional(),
  badges: z.array(z.enum(productBadgeEnum.enumValues)),
  packagings: z.array(packagingInputSchema),
};

const createInputSchema = z.object(productMutableFields);
const updatePatchSchema = z.object(productMutableFields).partial();

/** Filtros (os mesmos do ZIP de imagens) + paginação numerada — página a partir de 1. */
const listInputSchema = portalProductFiltersSchema.extend({
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(100).default(DEFAULT_PORTAL_PER_PAGE),
});

/**
 * TODA mutação de catálogo feita no portal expira o cache do site NA HORA
 * (e não `"max"`, stale-while-revalidate): o operador salva — marca destaque,
 * cadastra uma embalagem, troca uma foto — e abre o site para conferir. Com
 * `"max"` a PRIMEIRA visita ainda mostrava o conteúdo antigo e a mudança
 * parecia não ter sido gravada ("as embalagens cadastradas não aparecem").
 * Edição manual é rara; a regeneração bloqueante da visita seguinte custa pouco.
 * O sync em lote do ERP não passa por aqui.
 */
const IMMEDIATE_EXPIRY = { expire: 0 };

/** Teto da vitrine gerenciável — bem acima do que a home exibe (máx. 12). */
const MAX_FEATURED_REORDER = 100;

/** Próxima posição livre no fim da vitrine (`max(featured_order) + 1`). */
async function nextFeaturedOrder(db: Database): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`coalesce(max(${products.featuredOrder}), -1)::int` })
    .from(products)
    .where(eq(products.featured, true));
  return (row?.value ?? -1) + 1;
}

/**
 * Miniatura de cada produto do lote: a CAPA do site (1ª imagem visível por
 * `sortOrder`); sem imagem visível, a 1ª imagem do portal — o operador ainda
 * reconhece o produto na tabela.
 */
async function loadCoverUrls(db: Database, productIds: string[]): Promise<Map<string, string>> {
  const covers = new Map<string, string>();
  if (productIds.length === 0) return covers;
  const rows = await db
    .select({ productId: productImages.productId, r2Key: productImages.r2Key })
    .from(productImages)
    .where(inArray(productImages.productId, productIds))
    .orderBy(desc(productImages.showOnSite), asc(productImages.sortOrder), asc(productImages.createdAt));
  for (const row of rows) {
    if (covers.has(row.productId)) continue;
    const url = safePublicUrl(row.r2Key);
    if (url) covers.set(row.productId, url);
  }
  return covers;
}

type PackagingSummary = { packagingType: PackagingTypeSlug; unitsPerPack: number };
type ImageCounts = { total: number; onSite: number };

/** Categorias + badges + packagings + imagens de um lote de produtos, indexados por productId. */
async function loadProductRelations(db: Database, productIds: string[]) {
  if (productIds.length === 0) {
    return {
      categoriesByProduct: new Map<string, (typeof categories.$inferSelect)[]>(),
      badgesByProduct: new Map<string, BadgeSlug[]>(),
      packagingsByProduct: new Map<string, PackagingSummary[]>(),
      imageCountsByProduct: new Map<string, ImageCounts>(),
    };
  }

  const [categoryRows, badgeRows, packagingRows, imageCountRows] = await Promise.all([
    db
      .select({ productId: productCategories.productId, category: categories })
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
      })
      // TODAS as embalagens (não só a "padrão"): a embalagem pode ser composta
      // e nenhuma é a principal — a tabela do portal mostra todas.
      .from(productPackagings)
      .where(inArray(productPackagings.productId, productIds)),
    db
      .select({
        productId: productImages.productId,
        total: sql<number>`count(*)::int`,
        onSite: sql<number>`count(*) filter (where ${productImages.showOnSite})::int`,
      })
      .from(productImages)
      .where(inArray(productImages.productId, productIds))
      .groupBy(productImages.productId),
  ]);

  const categoriesByProduct = new Map<string, (typeof categories.$inferSelect)[]>();
  for (const row of categoryRows) {
    const list = categoriesByProduct.get(row.productId) ?? [];
    list.push(row.category);
    categoriesByProduct.set(row.productId, list);
  }

  const badgesByProduct = new Map<string, BadgeSlug[]>();
  for (const row of badgeRows) {
    const list = badgesByProduct.get(row.productId) ?? [];
    list.push(row.badge);
    badgesByProduct.set(row.productId, list);
  }

  const packagingsByProduct = new Map<string, PackagingSummary[]>();
  for (const row of packagingRows) {
    const list = packagingsByProduct.get(row.productId) ?? [];
    list.push({ packagingType: row.packagingType, unitsPerPack: row.unitsPerPack });
    packagingsByProduct.set(row.productId, list);
  }
  for (const [productId, list] of packagingsByProduct) {
    packagingsByProduct.set(productId, sortPackagings(list));
  }

  const imageCountsByProduct = new Map<string, ImageCounts>();
  for (const row of imageCountRows) {
    imageCountsByProduct.set(row.productId, { total: row.total, onSite: row.onSite });
  }

  return { categoriesByProduct, badgesByProduct, packagingsByProduct, imageCountsByProduct };
}

/** Monta o shape completo de um produto (`byId`/`create`/`update`/`setPublished`). */
async function loadProductDetail(db: Database, productId: string) {
  const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  if (!product) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado." });
  }

  const [categoryRows, packagingRows, imageRows, badgeRows] = await Promise.all([
    db
      .select({ id: categories.id, isPrimary: productCategories.isPrimary })
      .from(productCategories)
      .innerJoin(categories, eq(categories.id, productCategories.categoryId))
      .where(eq(productCategories.productId, productId)),
    db.select().from(productPackagings).where(eq(productPackagings.productId, productId)),
    db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, productId))
      .orderBy(asc(productImages.sortOrder), asc(productImages.createdAt)),
    db.select({ badge: productBadges.badge }).from(productBadges).where(eq(productBadges.productId, productId)),
  ]);

  return {
    ...product,
    categories: categoryRows,
    packagings: packagingRows,
    images: imageRows.map(({ r2Key, ...image }) => ({ ...image, url: safePublicUrl(r2Key) ?? "" })),
    badges: badgeRows.map((row) => row.badge),
  };
}

async function replaceCategoryLinks(
  tx: Database,
  productId: string,
  categoryIds: string[],
  primaryCategoryId?: string
) {
  await tx.delete(productCategories).where(eq(productCategories.productId, productId));
  if (categoryIds.length > 0) {
    await tx.insert(productCategories).values(
      categoryIds.map((categoryId) => ({
        productId,
        categoryId,
        isPrimary: categoryId === primaryCategoryId,
      }))
    );
  }
}

async function replaceBadges(tx: Database, productId: string, badges: string[]) {
  await tx.delete(productBadges).where(eq(productBadges.productId, productId));
  if (badges.length > 0) {
    await tx.insert(productBadges).values(
      badges.map((badge) => ({ productId, badge: badge as (typeof productBadgeEnum.enumValues)[number] }))
    );
  }
}

async function replacePackagings(
  tx: Database,
  productId: string,
  packagings: z.infer<typeof packagingInputSchema>[]
) {
  await tx.delete(productPackagings).where(eq(productPackagings.productId, productId));
  if (packagings.length > 0) {
    await tx.insert(productPackagings).values(
      packagings.map((packaging) => ({
        productId,
        packagingType: packaging.packagingType,
        unitsPerPack: packaging.unitsPerPack,
        erpComplementCode: packaging.erpComplementCode ?? null,
        barcodeEan13: packaging.barcodeEan13 ?? null,
        isDefault: packaging.isDefault,
      }))
    );
  }
}

export const productsRouter = router({
  /**
   * Página numerada da tabela do portal. A contagem roda antes da página: a
   * página pedida é LIMITADA ao intervalo real (`?page=99` depois de um filtro
   * que sobrou 2 páginas devolve a 2, não uma tabela vazia) e o cliente adota
   * o `page` devolvido.
   */
  list: permissionProcedure("products", "read")
    .input(listInputSchema)
    .query(async ({ ctx, input }) => {
      const { page, perPage, ...filters } = input;
      const where = portalProductConditions(ctx.db, filters);

      const [countRow] = await ctx.db
        .select({ total: sql<number>`count(*)::int` })
        .from(products)
        .where(where);
      const total = countRow?.total ?? 0;
      const safePage = clampPage(page, total, perPage);

      const rows =
        total === 0
          ? []
          : await ctx.db
              .select()
              .from(products)
              .where(where)
              .orderBy(asc(products.sku))
              .limit(perPage)
              .offset((safePage - 1) * perPage);

      const pageIds = rows.map((product) => product.id);
      const [
        { categoriesByProduct, badgesByProduct, packagingsByProduct, imageCountsByProduct },
        coverByProduct,
      ] = await Promise.all([loadProductRelations(ctx.db, pageIds), loadCoverUrls(ctx.db, pageIds)]);

      const items = rows.map((product) => {
        const imageCounts = imageCountsByProduct.get(product.id) ?? { total: 0, onSite: 0 };
        return {
          ...product,
          categories: categoriesByProduct.get(product.id) ?? [],
          badges: badgesByProduct.get(product.id) ?? [],
          imageCount: imageCounts.total,
          siteImageCount: imageCounts.onSite,
          coverUrl: coverByProduct.get(product.id) ?? null,
          packagings: packagingsByProduct.get(product.id) ?? [],
        };
      });

      return { items, total, page: safePage, perPage };
    }),

  /**
   * Uma query agregada (FILTER) para os cards do dashboard. Contagens de
   * vitrine/saúde consideram só produtos ativos; "sem foto" olha os
   * PUBLICADOS sem nenhuma imagem marcada para o SITE — é o que o visitante
   * vê com o espaço reservado, mesmo que haja imagens só no portal.
   */
  stats: permissionProcedure("products", "read").query(async ({ ctx }) => {
    const hasNoImage = sql`not ${siteImageExists(ctx.db)}`;
    const [row] = await ctx.db
      .select({
        total: sql<number>`count(*) filter (where ${products.active} = true)::int`,
        published: sql<number>`count(*) filter (where ${products.published} = true and ${products.active} = true)::int`,
        active: sql<number>`count(*) filter (where ${products.active} = true)::int`,
        unpublished: sql<number>`count(*) filter (where ${products.published} = false and ${products.active} = true)::int`,
        featured: sql<number>`count(*) filter (where ${products.featured} = true and ${products.active} = true)::int`,
        bestSeller: sql<number>`count(*) filter (where ${products.bestSeller} = true and ${products.active} = true)::int`,
        publishedWithoutImage: sql<number>`count(*) filter (where ${products.published} = true and ${products.active} = true and ${hasNoImage})::int`,
      })
      .from(products);

    return (
      row ?? {
        total: 0,
        published: 0,
        active: 0,
        unpublished: 0,
        featured: 0,
        bestSeller: 0,
        publishedWithoutImage: 0,
      }
    );
  }),

  /** Alterna as flags de vitrine em um clique (tabela do portal). */
  setFlags: permissionProcedure("products", "update")
    .input(
      z
        .object({
          id: z.string().uuid(),
          featured: z.boolean().optional(),
          bestSeller: z.boolean().optional(),
        })
        .refine((value) => value.featured !== undefined || value.bestSeller !== undefined, {
          message: "Informe ao menos uma flag.",
        })
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ featured: products.featured })
        .from(products)
        .where(eq(products.id, input.id))
        .limit(1);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado." });
      }

      const setValues: Partial<typeof products.$inferInsert> = { updatedAt: new Date() };
      if (input.bestSeller !== undefined) setValues.bestSeller = input.bestSeller;
      if (input.featured !== undefined) {
        setValues.featured = input.featured;
        // Entrou agora na vitrine → vai para o fim da fila (RF05).
        if (input.featured && !existing.featured) {
          setValues.featuredOrder = await nextFeaturedOrder(ctx.db);
        }
      }

      await ctx.db.update(products).set(setValues).where(eq(products.id, input.id));
      await writeAuditLog(ctx.db, ctx.session, {
        action: "products.setFlags",
        resource: "products",
        resourceId: input.id,
        metadata: { featured: input.featured, bestSeller: input.bestSeller },
      });
      revalidateTag("products", IMMEDIATE_EXPIRY);

      return loadProductDetail(ctx.db, input.id);
    }),

  /** Vitrine da home na ordem de exibição (inclui não publicados, sinalizados na UI). */
  featuredList: permissionProcedure("products", "read").query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: products.id,
        sku: products.sku,
        slug: products.slug,
        namePt: products.namePt,
        nameEn: products.nameEn,
        published: products.published,
        active: products.active,
        bestSeller: products.bestSeller,
        featuredOrder: products.featuredOrder,
      })
      .from(products)
      .where(and(eq(products.featured, true), eq(products.active, true)))
      .orderBy(asc(products.featuredOrder), asc(products.sku))
      .limit(MAX_FEATURED_REORDER);

    const covers = await loadCoverUrls(
      ctx.db,
      rows.map((row) => row.id)
    );
    return rows.map((row) => ({ ...row, coverUrl: covers.get(row.id) ?? null }));
  }),

  /** Reordena a vitrine: a posição é o índice no array recebido. */
  reorderFeatured: permissionProcedure("products", "update")
    .input(z.object({ orderedIds: z.array(z.string().uuid()).min(1).max(MAX_FEATURED_REORDER) }))
    .mutation(async ({ ctx, input }) => {
      if (new Set(input.orderedIds).size !== input.orderedIds.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Lista com produto repetido." });
      }
      await ctx.db.transaction(async (tx) => {
        for (const [index, id] of input.orderedIds.entries()) {
          await tx
            .update(products)
            .set({ featuredOrder: index, updatedAt: new Date() })
            .where(and(eq(products.id, id), eq(products.featured, true)));
        }
      });
      await writeAuditLog(ctx.db, ctx.session, {
        action: "products.reorderFeatured",
        resource: "products",
        metadata: { count: input.orderedIds.length },
      });
      revalidateTag("products", IMMEDIATE_EXPIRY);
      return { ok: true as const };
    }),

  byId: permissionProcedure("products", "read")
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => loadProductDetail(ctx.db, input.id)),

  create: permissionProcedure("products", "create")
    .input(createInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.published && !hasPermission(ctx.session, "products", "publish")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para publicar produtos." });
      }
      const slug = input.slug || slugify(input.namePt);
      if (!slug) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Não foi possível gerar um slug válido." });
      }

      const featured = input.featured ?? false;
      const featuredOrder = featured ? (input.featuredOrder ?? (await nextFeaturedOrder(ctx.db))) : 0;

      let productId: string;
      try {
        productId = await ctx.db.transaction(async (tx) => {
          const [inserted] = await tx
            .insert(products)
            .values({
              sku: input.sku,
              erpCode: input.erpCode ?? null,
              slug,
              namePt: input.namePt,
              nameEn: input.nameEn ?? null,
              descriptionPt: input.descriptionPt ?? null,
              descriptionEn: input.descriptionEn ?? null,
              ncm: input.ncm ?? null,
              barcodeEan13: input.barcodeEan13 ?? null,
              published: input.published ?? false,
              featured,
              featuredOrder,
              bestSeller: input.bestSeller ?? false,
            })
            .returning({ id: products.id });

          await replaceCategoryLinks(tx, inserted.id, input.categoryIds, input.primaryCategoryId);
          await replaceBadges(tx, inserted.id, input.badges);
          await replacePackagings(tx, inserted.id, input.packagings);

          return inserted.id;
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw translateDbError(error, "Falha ao criar o produto.");
      }

      await writeAuditLog(ctx.db, ctx.session, {
        action: "products.create",
        resource: "products",
        resourceId: productId,
        metadata: { sku: input.sku, namePt: input.namePt },
      });
      revalidateTag("products", IMMEDIATE_EXPIRY);

      return loadProductDetail(ctx.db, productId);
    }),

  update: permissionProcedure("products", "update")
    .input(z.object({ id: z.string().uuid(), patch: updatePatchSchema }))
    .mutation(async ({ ctx, input }) => {
      const { id, patch } = input;

      const setValues: Partial<typeof products.$inferInsert> = {};
      if (patch.sku !== undefined) setValues.sku = patch.sku;
      if (patch.erpCode !== undefined) setValues.erpCode = patch.erpCode;
      if (patch.slug !== undefined) setValues.slug = patch.slug;
      if (patch.namePt !== undefined) setValues.namePt = patch.namePt;
      if (patch.nameEn !== undefined) setValues.nameEn = patch.nameEn;
      if (patch.descriptionPt !== undefined) setValues.descriptionPt = patch.descriptionPt;
      if (patch.descriptionEn !== undefined) setValues.descriptionEn = patch.descriptionEn;
      if (patch.ncm !== undefined) setValues.ncm = patch.ncm;
      if (patch.barcodeEan13 !== undefined) setValues.barcodeEan13 = patch.barcodeEan13;
      if (patch.published !== undefined) setValues.published = patch.published;
      if (patch.bestSeller !== undefined) setValues.bestSeller = patch.bestSeller;
      if (patch.featured !== undefined) setValues.featured = patch.featured;
      if (patch.featuredOrder !== undefined) setValues.featuredOrder = patch.featuredOrder;
      setValues.updatedAt = new Date();

      try {
        await ctx.db.transaction(async (tx) => {
          const [existing] = await tx
            .select({ id: products.id, featured: products.featured, published: products.published })
            .from(products)
            .where(eq(products.id, id))
            .limit(1);
          if (!existing) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado." });
          }
          // O formulário reenvia o `published` atual; só MUDAR exige a permissão.
          if (
            patch.published !== undefined &&
            patch.published !== existing.published &&
            !hasPermission(ctx.session, "products", "publish")
          ) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para publicar produtos." });
          }
          // Entrou agora na vitrine sem posição explícita → fim da fila (RF05).
          if (patch.featured === true && !existing.featured && patch.featuredOrder === undefined) {
            setValues.featuredOrder = await nextFeaturedOrder(tx);
          }

          await tx.update(products).set(setValues).where(eq(products.id, id));

          if (patch.categoryIds !== undefined) {
            await replaceCategoryLinks(tx, id, patch.categoryIds, patch.primaryCategoryId);
          }
          if (patch.badges !== undefined) {
            await replaceBadges(tx, id, patch.badges);
          }
          if (patch.packagings !== undefined) {
            await replacePackagings(tx, id, patch.packagings);
          }
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw translateDbError(error, "Falha ao atualizar o produto.");
      }

      await writeAuditLog(ctx.db, ctx.session, {
        action: "products.update",
        resource: "products",
        resourceId: id,
        metadata: { changedFields: Object.keys(patch) },
      });
      revalidateTag("products", IMMEDIATE_EXPIRY);

      return loadProductDetail(ctx.db, id);
    }),

  delete: permissionProcedure("products", "delete")
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(products)
        .set({ active: false, updatedAt: new Date() })
        .where(eq(products.id, input.id))
        .returning({ id: products.id });

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado." });
      }

      await writeAuditLog(ctx.db, ctx.session, {
        action: "products.delete",
        resource: "products",
        resourceId: input.id,
      });
      revalidateTag("products", IMMEDIATE_EXPIRY);

      return { success: true as const };
    }),

  setPublished: permissionProcedure("products", "publish")
    .input(z.object({ id: z.string().uuid(), published: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(products)
        .set({ published: input.published, updatedAt: new Date() })
        .where(eq(products.id, input.id))
        .returning({ id: products.id });

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado." });
      }

      await writeAuditLog(ctx.db, ctx.session, {
        action: "products.setPublished",
        resource: "products",
        resourceId: input.id,
        metadata: { published: input.published },
      });
      revalidateTag("products", IMMEDIATE_EXPIRY);

      return loadProductDetail(ctx.db, input.id);
    }),

  presignImageUpload: permissionProcedure("product_images", "create")
    .input(
      z.object({
        productId: z.string().uuid(),
        filename: z.string().trim().min(1).max(255),
        contentType: z.enum(ALLOWED_IMAGE_TYPES),
        sizeBytes: z.number().int().positive().max(MAX_IMAGE_BYTES),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const rateLimit = await checkRateLimit(`presign:user:${ctx.session.user.id}`, PRESIGN_RATE_LIMIT);
      if (!rateLimit.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Muitas solicitações de upload. Tente novamente em instantes.",
        });
      }

      const [product] = await ctx.db
        .select({ sku: products.sku })
        .from(products)
        .where(eq(products.id, input.productId))
        .limit(1);
      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado." });
      }

      const extension = CONTENT_TYPE_EXTENSION[input.contentType];
      const key = `products/${product.sku}/${crypto.randomUUID()}.${extension}`;

      let uploadUrl: string;
      try {
        uploadUrl = await getPresignedUploadUrl(key, input.contentType);
      } catch (error) {
        console.error("[products.presignImageUpload]", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Armazenamento de imagens indisponível no momento.",
        });
      }

      return { uploadUrl, key };
    }),

  confirmImageUpload: permissionProcedure("product_images", "create")
    .input(
      z.object({
        productId: z.string().uuid(),
        key: z.string().trim().min(1),
        filename: z.string().trim().min(1).max(255),
        contentType: z.enum(ALLOWED_IMAGE_TYPES),
        altPt: z.string().trim().min(1).optional(),
        /** Aparece no site? Desmarcada, fica só no portal (ex.: foto em alta só para download). */
        showOnSite: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [product] = await ctx.db
        .select({ sku: products.sku })
        .from(products)
        .where(eq(products.id, input.productId))
        .limit(1);
      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado." });
      }

      // A key precisa pertencer ao prefixo do próprio produto — evita registrar
      // um objeto de outro produto/rota informado manualmente pelo cliente.
      if (!input.key.startsWith(`products/${product.sku}/`)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Referência de upload inválida." });
      }

      let sizeBytes: number;
      try {
        const head = await headObject(input.key);
        sizeBytes = head.ContentLength ?? 0;
      } catch (error) {
        console.error("[products.confirmImageUpload]", error);
        throw new TRPCError({ code: "BAD_REQUEST", message: "Upload não encontrado ou expirado." });
      }

      if (sizeBytes <= 0 || sizeBytes > MAX_IMAGE_BYTES) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Arquivo inválido (tamanho)." });
      }

      // Entra no FIM da ordem de exibição — antes todo upload ficava com
      // `sortOrder` 0 e a ordem entre eles dependia do banco.
      const [position] = await ctx.db
        .select({ next: sql<number>`coalesce(max(${productImages.sortOrder}) + 1, 0)::int` })
        .from(productImages)
        .where(eq(productImages.productId, input.productId));

      const [image] = await ctx.db
        .insert(productImages)
        .values({
          productId: input.productId,
          r2Key: input.key,
          filename: input.filename,
          contentType: input.contentType,
          sizeBytes,
          altPt: input.altPt ?? null,
          sortOrder: position?.next ?? 0,
          showOnSite: input.showOnSite,
        })
        .returning();

      await writeAuditLog(ctx.db, ctx.session, {
        action: "product_images.create",
        resource: "products",
        resourceId: input.productId,
        metadata: { imageId: image.id },
      });
      revalidateTag("products", IMMEDIATE_EXPIRY);

      return { ...image, url: safePublicUrl(image.r2Key) ?? "" };
    }),

  deleteImage: permissionProcedure("product_images", "delete")
    .input(z.object({ imageId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [image] = await ctx.db
        .select()
        .from(productImages)
        .where(eq(productImages.id, input.imageId))
        .limit(1);
      if (!image) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Imagem não encontrada." });
      }

      try {
        await deleteObject(image.r2Key);
      } catch (error) {
        // Loga e segue: preferimos remover o registro (evita imagem "fantasma"
        // na UI) mesmo se a limpeza do objeto no R2 falhar.
        console.error("[products.deleteImage] Falha ao remover objeto do R2.", error);
      }

      await ctx.db.delete(productImages).where(eq(productImages.id, input.imageId));

      await writeAuditLog(ctx.db, ctx.session, {
        action: "product_images.delete",
        resource: "products",
        resourceId: image.productId,
        metadata: { imageId: image.id },
      });
      revalidateTag("products", IMMEDIATE_EXPIRY);

      return { success: true as const };
    }),

  /** Marca se a imagem aparece no site (listagem, detalhe, orçamento); desmarcada, fica só no portal. */
  setImageVisibility: permissionProcedure("product_images", "update")
    .input(z.object({ imageId: z.string().uuid(), showOnSite: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [image] = await ctx.db
        .update(productImages)
        .set({ showOnSite: input.showOnSite })
        .where(eq(productImages.id, input.imageId))
        .returning({ productId: productImages.productId });
      if (!image) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Imagem não encontrada." });
      }

      await writeAuditLog(ctx.db, ctx.session, {
        action: "product_images.setVisibility",
        resource: "products",
        resourceId: image.productId,
        metadata: { imageId: input.imageId, showOnSite: input.showOnSite },
      });
      revalidateTag("products", IMMEDIATE_EXPIRY);

      return { success: true as const };
    }),

  /**
   * Capa da listagem no site: a imagem vai para o início da ordem de exibição
   * (as demais mantêm a ordem relativa) e passa a aparecer no site — não
   * existe capa escondida.
   */
  setCoverImage: permissionProcedure("product_images", "update")
    .input(z.object({ imageId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const productId = await ctx.db.transaction(async (tx) => {
        const [image] = await tx
          .select({ productId: productImages.productId })
          .from(productImages)
          .where(eq(productImages.id, input.imageId))
          .limit(1);
        if (!image) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Imagem não encontrada." });
        }

        const siblings = await tx
          .select({ id: productImages.id })
          .from(productImages)
          .where(eq(productImages.productId, image.productId))
          .orderBy(asc(productImages.sortOrder), asc(productImages.createdAt));

        const order = moveToFront(
          siblings.map((row) => row.id),
          input.imageId
        );
        for (const [index, id] of order.entries()) {
          await tx
            .update(productImages)
            .set(id === input.imageId ? { sortOrder: index, showOnSite: true } : { sortOrder: index })
            .where(eq(productImages.id, id));
        }
        return image.productId;
      });

      await writeAuditLog(ctx.db, ctx.session, {
        action: "product_images.setCover",
        resource: "products",
        resourceId: productId,
        metadata: { imageId: input.imageId },
      });
      revalidateTag("products", IMMEDIATE_EXPIRY);

      return { success: true as const };
    }),

  /**
   * Tamanho de um download em lote (produtos com imagem, imagens e bytes) com
   * os MESMOS filtros da tabela — a tela mostra antes de começar e barra o que
   * passa do limite do ZIP. Sem `includeInactive`: o ZIP nunca leva produto
   * inativo, e o resumo tem de contar exatamente o que o ZIP vai levar.
   */
  imagesSummary: permissionProcedure("product_images", "download")
    .input(portalProductFiltersSchema.omit({ includeInactive: true }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({
          productCount: sql<number>`count(distinct ${products.id})::int`,
          imageCount: sql<number>`count(${productImages.id})::int`,
          totalBytes: sql<number>`coalesce(sum(${productImages.sizeBytes}), 0)::float8`,
        })
        .from(products)
        .innerJoin(productImages, eq(productImages.productId, products.id))
        .where(portalProductConditions(ctx.db, input));

      return row ?? { productCount: 0, imageCount: 0, totalBytes: 0 };
    }),

  categories: router({
    /** Lista flat (sem árvore) — hierarquia (`parentId`) existe no modelo mas não é consumida ainda. */
    list: permissionProcedure("products", "read").query(async ({ ctx }) => {
      return ctx.db
        .select({ id: categories.id, namePt: categories.namePt, nameEn: categories.nameEn })
        .from(categories)
        .where(eq(categories.active, true))
        .orderBy(asc(categories.sortOrder), asc(categories.namePt));
    }),
  }),
});
