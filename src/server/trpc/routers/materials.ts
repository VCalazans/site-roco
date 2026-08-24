import "server-only";
import { TRPCError } from "@trpc/server";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  deleteObject,
  getPresignedDownloadUrl,
  getPresignedUploadUrl,
  headObject,
} from "@/core/storage/r2";
import { db as dbClient } from "@/db";
import { materials, type Material } from "@/db/schema/materials";
import { writeAuditLog } from "@/server/lib/audit";
import { getExtension, isSizeWithinLimit } from "@/server/lib/upload-limits";
import { permissionProcedure, router } from "../init";

/**
 * Tipos aceitos para materiais — origem única de verdade em
 * `@/server/lib/upload-limits` (campo `"material"`), reaproveitada por
 * `presignUpload`/`confirmUpload`/`create`/`update` neste router.
 */
const MATERIAL_CONTENT_TYPES = [
  "application/pdf",
  "video/mp4",
  "video/webm",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
const materialContentTypeSchema = z.enum(MATERIAL_CONTENT_TYPES);

/**
 * URL de leitura temporária tolerante a R2 não configurado (dev) — mesmo
 * padrão de `representatives.ts` (`safeDownloadUrl`). Materiais são
 * SEMPRE privados (nunca `R2_PUBLIC_URL`): conteúdo comercial interno,
 * não deve ficar acessível sem login (ver decisionLog 2026-08-24).
 */
async function safeDownloadUrl(key: string): Promise<string> {
  try {
    return await getPresignedDownloadUrl(key);
  } catch (error) {
    console.error("[materials] Falha ao gerar URL de leitura do material.", error);
    return "";
  }
}

async function withDownloadUrl(row: Material) {
  const downloadUrl = await safeDownloadUrl(row.r2Key);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- excluído de propósito do payload (nunca expor a chave crua do R2)
  const { r2Key: _r2Key, ...rest } = row;
  return { ...rest, downloadUrl };
}

const materialMutableFields = {
  titlePt: z.string().trim().min(1).max(200),
  titleEn: z.string().trim().max(200).optional().nullable(),
  descriptionPt: z.string().trim().max(2000).optional().nullable(),
  descriptionEn: z.string().trim().max(2000).optional().nullable(),
  /** Texto livre — opções sugeridas pela UI (política comercial, logística,
   *  contatos, treinamento, outro), sem constraint de banco. */
  category: z.string().trim().max(40).optional().nullable(),
  r2Key: z.string().trim().min(1).refine((value) => value.startsWith("materials/"), {
    message: 'Chave de upload inválida (deve começar com "materials/").',
  }),
  filename: z.string().trim().min(1).max(255),
  contentType: materialContentTypeSchema,
  sizeBytes: z.number().int().positive(),
  published: z.boolean().default(false),
};

const createInputSchema = z.object(materialMutableFields);
const updateInputSchema = z
  .object(materialMutableFields)
  .partial()
  .extend({ id: z.string().uuid() });

export const materialsRouter = router({
  /** Lista TODOS os materiais (publicados e rascunho) — admin only. */
  list: permissionProcedure("materials", "create").query(async () => {
    const rows: Material[] = await dbClient
      .select()
      .from(materials)
      .orderBy(desc(materials.createdAt));
    return Promise.all(rows.map(withDownloadUrl));
  }),

  /**
   * Feed somente-leitura consumido pela página de boas-vindas do
   * representante (`WelcomeMaterialsFeed`). Só materiais publicados,
   * ordenados como "linha do tempo" por `publishedAt` (o campo que nunca
   * é sobrescrito após a primeira publicação).
   */
  listPublished: permissionProcedure("materials", "read").query(async () => {
    const rows: Material[] = await dbClient
      .select()
      .from(materials)
      .where(eq(materials.published, true))
      .orderBy(sql`${materials.publishedAt} DESC NULLS LAST`, desc(materials.createdAt));
    return Promise.all(rows.map(withDownloadUrl));
  }),

  /** Cria novo material (upload já confirmado via `confirmUpload`). */
  create: permissionProcedure("materials", "create")
    .input(createInputSchema)
    .mutation(async ({ ctx, input }) => {
      const [row] = await dbClient
        .insert(materials)
        .values({
          titlePt: input.titlePt,
          titleEn: input.titleEn ?? null,
          descriptionPt: input.descriptionPt ?? null,
          descriptionEn: input.descriptionEn ?? null,
          category: input.category ?? null,
          r2Key: input.r2Key,
          filename: input.filename,
          contentType: input.contentType,
          sizeBytes: input.sizeBytes,
          published: input.published,
          publishedAt: input.published ? new Date() : null,
          createdByUserId: ctx.session.user.id,
        })
        .returning();
      if (!row) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao criar material." });
      }

      await writeAuditLog(ctx.db, ctx.session, {
        action: "materials.create",
        resource: "materials",
        resourceId: row.id,
        metadata: { titlePt: row.titlePt },
      });
      return withDownloadUrl(row);
    }),

  /**
   * Edita material existente (troca de arquivo opcional — `r2Key`/
   * `filename`/`contentType`/`sizeBytes` novos, já upados via
   * presign/confirm antes desta chamada, mesmo padrão de `hero-slides`).
   * `publishedAt` é setado só na 1ª vez que `published` vira `true` e
   * NUNCA sobrescrito depois (mesmo despublicando/republicando).
   */
  update: permissionProcedure("materials", "update")
    .input(updateInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...patch } = input;
      const [existing] = await dbClient.select().from(materials).where(eq(materials.id, id)).limit(1);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Material não encontrado." });
      }

      const nextPublished = patch.published ?? existing.published;
      const publishedAt = nextPublished && !existing.publishedAt ? new Date() : existing.publishedAt;

      const [row] = await dbClient
        .update(materials)
        .set({ ...patch, publishedAt, updatedAt: new Date() })
        .where(eq(materials.id, id))
        .returning();
      if (!row) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao atualizar material." });
      }

      await writeAuditLog(ctx.db, ctx.session, {
        action: "materials.update",
        resource: "materials",
        resourceId: id,
        metadata: { changedFields: Object.keys(patch) },
      });
      return withDownloadUrl(row);
    }),

  /** Exclui (apaga o objeto do R2; falha não bloqueia a exclusão do registro). */
  delete: permissionProcedure("materials", "delete")
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [material] = await dbClient
        .select()
        .from(materials)
        .where(eq(materials.id, input.id))
        .limit(1);
      if (!material) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Material não encontrado." });
      }

      try {
        await deleteObject(material.r2Key);
      } catch (error) {
        // Preferir orfão no bucket a "material fantasma" no banco.
        console.error("[materials.delete] Falha ao remover arquivo do R2.", error);
      }

      await dbClient.delete(materials).where(eq(materials.id, input.id));
      await writeAuditLog(ctx.db, ctx.session, {
        action: "materials.delete",
        resource: "materials",
        resourceId: input.id,
      });
      return { ok: true as const };
    }),

  /** 2-step upload: presign → PUT → confirm. Mesmo padrão de hero/produtos. */
  presignUpload: permissionProcedure("materials", "create")
    .input(
      z
        .object({
          filename: z.string().trim().min(1).max(255),
          contentType: materialContentTypeSchema,
          sizeBytes: z.number().int().positive(),
        })
        .superRefine((data, ctx) => {
          if (!isSizeWithinLimit("material", data.contentType, data.sizeBytes)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["sizeBytes"],
              message: "Arquivo excede o tamanho máximo permitido para este tipo.",
            });
          }
        })
    )
    .mutation(async ({ input }) => {
      const extension = getExtension("material", input.contentType);
      if (!extension) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Tipo de arquivo não suportado." });
      }
      const key = `materials/${crypto.randomUUID()}.${extension}`;

      let uploadUrl: string;
      try {
        uploadUrl = await getPresignedUploadUrl(key, input.contentType);
      } catch (error) {
        console.error("[materials.presignUpload]", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Armazenamento de materiais indisponível no momento.",
        });
      }
      return { uploadUrl, key };
    }),

  confirmUpload: permissionProcedure("materials", "create")
    .input(
      z.object({
        key: z.string().trim().min(1),
        filename: z.string().trim().min(1).max(255),
        contentType: materialContentTypeSchema,
      })
    )
    .mutation(async ({ input }) => {
      if (!input.key.startsWith("materials/")) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Referência de upload inválida." });
      }

      let sizeBytes: number;
      try {
        const head = await headObject(input.key);
        sizeBytes = head.ContentLength ?? 0;
      } catch (error) {
        console.error("[materials.confirmUpload]", error);
        throw new TRPCError({ code: "BAD_REQUEST", message: "Upload não encontrado ou expirado." });
      }

      if (!isSizeWithinLimit("material", input.contentType, sizeBytes)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Arquivo inválido (tamanho)." });
      }
      return { key: input.key, sizeBytes };
    }),
});
