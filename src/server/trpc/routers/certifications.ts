import "server-only";
import { revalidateTag } from "next/cache";
import { TRPCError } from "@trpc/server";
import { asc, count, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { deleteObject, getPresignedUploadUrl, headObject } from "@/core/storage/r2";
import { certifications } from "@/db/schema";
import {
  CERTIFICATION_IMAGE_KEY_PREFIX,
  certificationInputSchema,
  isCertificationImageKey,
  MAX_CERTIFICATIONS,
} from "@/modules/certifications/lib/certifications";
import { writeAuditLog } from "@/server/lib/audit";
import { certificationImageUrl, CERTIFICATIONS_CACHE_TAG } from "@/server/lib/certifications";
import { checkRateLimit } from "@/server/lib/rate-limit";
import { getExtension, isContentTypeAllowed, isSizeWithinLimit } from "@/shared/lib/upload-limits";
import { permissionProcedure, router } from "../init";

/**
 * Selos de certificação (Configurações do Site › Certificações). Mesma
 * permissão da tela de Configurações (`users:manage`, só admin). Toda mutação
 * expira a tag na hora: quem cadastra abre o site em seguida.
 */
const manageProcedure = permissionProcedure("users", "manage");
const IMMEDIATE_EXPIRY = { expire: 0 };
const PRESIGN_RATE_LIMIT = { windowSeconds: 5 * 60, max: 30 };

function expireCache() {
  revalidateTag(CERTIFICATIONS_CACHE_TAG, IMMEDIATE_EXPIRY);
}

/** Confere o objeto GRAVADO (tipo, extensão, tamanho); fora do contrato, apaga e recusa. */
async function verifyStoredImage(key: string): Promise<number> {
  let head: Awaited<ReturnType<typeof headObject>>;
  try {
    head = await headObject(key);
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Imagem não encontrada. Envie o arquivo novamente." });
  }
  const contentType = (head.ContentType ?? "").split(";")[0].trim().toLowerCase();
  const keyExtension = key.slice(key.lastIndexOf(".") + 1);
  const valid =
    getExtension("siteImage", contentType) === keyExtension &&
    isSizeWithinLimit("siteImage", contentType, head.ContentLength ?? 0);
  if (!valid) {
    await deleteObject(key).catch(() => undefined);
    throw new TRPCError({ code: "BAD_REQUEST", message: "Arquivo inválido: envie uma imagem JPEG, PNG ou WebP de até 10 MB." });
  }
  return head.ContentLength ?? 0;
}

async function removeImage(key: string | null | undefined) {
  if (!key || !isCertificationImageKey(key)) return;
  await deleteObject(key).catch((error) => console.error("[certifications] Falha ao apagar imagem antiga.", error));
}

export const certificationsRouter = router({
  list: manageProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(certifications)
      .orderBy(asc(certifications.sortOrder), asc(certifications.createdAt));
    return rows.map((row) => ({ ...row, imageUrl: certificationImageUrl(row) }));
  }),

  create: manageProcedure.input(certificationInputSchema).mutation(async ({ ctx, input }) => {
    const [{ total }] = await ctx.db.select({ total: count() }).from(certifications);
    if (total >= MAX_CERTIFICATIONS) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `Limite de ${MAX_CERTIFICATIONS} selos atingido.` });
    }
    if (!input.imageKey) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Envie a imagem do selo." });
    }
    await verifyStoredImage(input.imageKey);

    const [{ next }] = await ctx.db
      .select({ next: sql<number>`coalesce(max(${certifications.sortOrder}), -1)::int + 1` })
      .from(certifications);
    const [row] = await ctx.db
      .insert(certifications)
      .values({ ...input, imagePath: null, sortOrder: next, updatedByUserId: ctx.session.user.id })
      .returning({ id: certifications.id });

    await writeAuditLog(ctx.db, ctx.session, {
      action: "certifications.create",
      resource: "certifications",
      resourceId: row.id,
      metadata: { name: input.namePt, validUntil: input.validUntil },
    });
    expireCache();
    return { id: row.id };
  }),

  update: manageProcedure
    .input(z.object({ id: z.string().uuid(), data: certificationInputSchema }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db.select().from(certifications).where(eq(certifications.id, input.id)).limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Selo não encontrado." });

      // Sem imagem nova: mantém a atual (upload anterior ou arquivo de `public/`).
      const imageChanged = Boolean(input.data.imageKey) && input.data.imageKey !== existing.imageKey;
      if (imageChanged) await verifyStoredImage(input.data.imageKey as string);
      if (!input.data.imageKey && !existing.imageKey && !existing.imagePath) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Envie a imagem do selo." });
      }

      await ctx.db
        .update(certifications)
        .set({
          ...input.data,
          imageKey: imageChanged ? input.data.imageKey : existing.imageKey,
          // Imagem nova enviada: a de `public/` deixa de valer.
          imagePath: imageChanged ? null : existing.imagePath,
          updatedByUserId: ctx.session.user.id,
          updatedAt: new Date(),
        })
        .where(eq(certifications.id, input.id));
      if (imageChanged) await removeImage(existing.imageKey);

      await writeAuditLog(ctx.db, ctx.session, {
        action: "certifications.update",
        resource: "certifications",
        resourceId: input.id,
        metadata: { name: input.data.namePt, validUntil: input.data.validUntil, active: input.data.active },
      });
      expireCache();
      return { ok: true as const };
    }),

  delete: manageProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const [removed] = await ctx.db
      .delete(certifications)
      .where(eq(certifications.id, input.id))
      .returning({ imageKey: certifications.imageKey, namePt: certifications.namePt });
    if (!removed) throw new TRPCError({ code: "NOT_FOUND", message: "Selo não encontrado." });
    await removeImage(removed.imageKey);
    await writeAuditLog(ctx.db, ctx.session, {
      action: "certifications.delete",
      resource: "certifications",
      resourceId: input.id,
      metadata: { name: removed.namePt },
    });
    expireCache();
    return { ok: true as const };
  }),

  /** Nova ordem de exibição (lista completa de ids, na ordem desejada). */
  reorder: manageProcedure
    .input(z.object({ ids: z.array(z.string().uuid()).min(1).max(MAX_CERTIFICATIONS) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.transaction(async (tx) => {
        for (const [index, id] of input.ids.entries()) {
          await tx.update(certifications).set({ sortOrder: index }).where(eq(certifications.id, id));
        }
      });
      await writeAuditLog(ctx.db, ctx.session, {
        action: "certifications.reorder",
        resource: "certifications",
        metadata: { ids: input.ids },
      });
      expireCache();
      return { ok: true as const };
    }),

  presignImage: manageProcedure
    .input(
      z
        .object({
          filename: z.string().trim().min(1).max(255),
          contentType: z.string().trim().min(1).max(100),
          sizeBytes: z.number().int().positive(),
        })
        .superRefine((data, ctx) => {
          if (!isContentTypeAllowed("siteImage", data.contentType)) {
            ctx.addIssue({ code: "custom", path: ["contentType"], message: "Formato não suportado (JPEG, PNG ou WebP)." });
            return;
          }
          if (!isSizeWithinLimit("siteImage", data.contentType, data.sizeBytes)) {
            ctx.addIssue({ code: "custom", path: ["sizeBytes"], message: "Imagem acima do tamanho máximo (10 MB)." });
          }
        })
    )
    .mutation(async ({ ctx, input }) => {
      const rateLimit = await checkRateLimit(`presign:user:${ctx.session.user.id}`, PRESIGN_RATE_LIMIT);
      if (!rateLimit.allowed) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Muitas solicitações de upload. Tente novamente em instantes." });
      }
      const extension = getExtension("siteImage", input.contentType);
      if (!extension) throw new TRPCError({ code: "BAD_REQUEST", message: "Formato não suportado." });
      const key = `${CERTIFICATION_IMAGE_KEY_PREFIX}${crypto.randomUUID()}.${extension}`;
      try {
        // Tipo e tamanho ASSINADOS: o PUT só grava exatamente o que foi declarado.
        const uploadUrl = await getPresignedUploadUrl(key, input.contentType, undefined, { sizeBytes: input.sizeBytes });
        return { uploadUrl, key };
      } catch (error) {
        console.error("[certifications.presignImage]", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Armazenamento de imagens indisponível no momento." });
      }
    }),

  confirmImage: manageProcedure
    .input(
      z.object({
        key: z.string().refine(isCertificationImageKey, "Imagem inválida."),
        filename: z.string().trim().min(1).max(255),
        contentType: z.string().trim().min(1).max(100),
      })
    )
    .mutation(async ({ input }) => {
      const sizeBytes = await verifyStoredImage(input.key);
      return { key: input.key, sizeBytes, url: certificationImageUrl({ imageKey: input.key, imagePath: null }) };
    }),
});
