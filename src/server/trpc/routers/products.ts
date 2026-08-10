import "server-only";
import { revalidateTag } from "next/cache";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, exists, gt, ilike, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
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
import { writeAuditLog } from "@/server/lib/audit";
import { translateDbError } from "@/server/lib/db-error";
import { slugify } from "@/server/lib/slugify";
import { permissionProcedure, router } from "../init";

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

const productMutableFields = {
  sku: z.string().trim().min(1).max(20),
  namePt: z.string().trim().min(1),
  slug: z.string().trim().min(1).max(220).optional(),
  erpCode: z.string().trim().max(20).optional(),
  nameEn: z.string().trim().min(1).optional(),
  descriptionPt: z.string().trim().min(1).optional(),
  descriptionEn: z.string().trim().min(1).optional(),
  ncm: z.string().trim().max(8).optional(),
  barcodeEan13: z.string().trim().max(13).optional(),
  published: z.boolean().optional(),
  categoryIds: z.array(z.string().uuid()),
  primaryCategoryId: z.string().uuid().optional(),
  badges: z.array(z.enum(productBadgeEnum.enumValues)),
  packagings: z.array(packagingInputSchema),
};

const createInputSchema = z.object(productMutableFields);
const updatePatchSchema = z.object(productMutableFields).partial();

const listInputSchema = z.object({
  search: z.string().trim().min(1).max(200).optional(),
  categoryId: z.string().uuid().optional(),
  published: z.boolean().optional(),
  cursor: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(25),
});

/** Categorias + badges + packagings + imagens de um lote de produtos, indexados por productId. */
async function loadProductRelations(db: Database, productIds: string[]) {
  if (productIds.length === 0) {
    return {
      categoriesByProduct: new Map<string, (typeof categories.$inferSelect)[]>(),
      badgesByProduct: new Map<string, BadgeSlug[]>(),
      defaultPackagingByProduct: new Map<
        string,
        { packagingType: PackagingTypeSlug; unitsPerPack: number }
      >(),
      imageCountByProduct: new Map<string, number>(),
    };
  }

  const [categoryRows, badgeRows, defaultPackagingRows, imageCountRows] = await Promise.all([
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
      .from(productPackagings)
      .where(and(inArray(productPackagings.productId, productIds), eq(productPackagings.isDefault, true))),
    db
      .select({ productId: productImages.productId, total: sql<number>`count(*)::int` })
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

  const defaultPackagingByProduct = new Map<
    string,
    { packagingType: PackagingTypeSlug; unitsPerPack: number }
  >();
  for (const row of defaultPackagingRows) {
    defaultPackagingByProduct.set(row.productId, {
      packagingType: row.packagingType,
      unitsPerPack: row.unitsPerPack,
    });
  }

  const imageCountByProduct = new Map<string, number>();
  for (const row of imageCountRows) {
    imageCountByProduct.set(row.productId, row.total);
  }

  return { categoriesByProduct, badgesByProduct, defaultPackagingByProduct, imageCountByProduct };
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
      .orderBy(asc(productImages.sortOrder)),
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
  list: permissionProcedure("products", "read")
    .input(listInputSchema)
    .query(async ({ ctx, input }) => {
      const { search, categoryId, published, cursor, limit } = input;

      const conditions = [];
      if (published !== undefined) {
        conditions.push(eq(products.published, published));
      }
      if (search) {
        const term = `%${search}%`;
        conditions.push(or(ilike(products.sku, term), ilike(products.namePt, term)));
      }
      if (categoryId) {
        conditions.push(
          exists(
            ctx.db
              .select({ one: sql`1` })
              .from(productCategories)
              .where(
                and(
                  eq(productCategories.productId, products.id),
                  eq(productCategories.categoryId, categoryId)
                )
              )
          )
        );
      }
      if (cursor) {
        const [cursorProduct] = await ctx.db
          .select({ sku: products.sku })
          .from(products)
          .where(eq(products.id, cursor))
          .limit(1);
        if (cursorProduct) {
          conditions.push(gt(products.sku, cursorProduct.sku));
        }
      }

      const rows = await ctx.db
        .select()
        .from(products)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(asc(products.sku))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;

      const { categoriesByProduct, badgesByProduct, defaultPackagingByProduct, imageCountByProduct } =
        await loadProductRelations(
          ctx.db,
          page.map((product) => product.id)
        );

      const items = page.map((product) => ({
        ...product,
        categories: categoriesByProduct.get(product.id) ?? [],
        badges: badgesByProduct.get(product.id) ?? [],
        imageCount: imageCountByProduct.get(product.id) ?? 0,
        defaultPackaging: defaultPackagingByProduct.get(product.id) ?? null,
      }));

      return {
        items,
        nextCursor: hasMore ? page[page.length - 1]?.id : undefined,
      };
    }),

  byId: permissionProcedure("products", "read")
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => loadProductDetail(ctx.db, input.id)),

  create: permissionProcedure("products", "create")
    .input(createInputSchema)
    .mutation(async ({ ctx, input }) => {
      const slug = input.slug || slugify(input.namePt);
      if (!slug) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Não foi possível gerar um slug válido." });
      }

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
      revalidateTag("products", "max");

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
      setValues.updatedAt = new Date();

      try {
        await ctx.db.transaction(async (tx) => {
          const [existing] = await tx.select({ id: products.id }).from(products).where(eq(products.id, id)).limit(1);
          if (!existing) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado." });
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
      revalidateTag("products", "max");

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
      revalidateTag("products", "max");

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
      revalidateTag("products", "max");

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

      const [image] = await ctx.db
        .insert(productImages)
        .values({
          productId: input.productId,
          r2Key: input.key,
          filename: input.filename,
          contentType: input.contentType,
          sizeBytes,
          altPt: input.altPt ?? null,
        })
        .returning();

      await writeAuditLog(ctx.db, ctx.session, {
        action: "product_images.create",
        resource: "products",
        resourceId: input.productId,
        metadata: { imageId: image.id },
      });
      revalidateTag("products", "max");

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
      revalidateTag("products", "max");

      return { success: true as const };
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
