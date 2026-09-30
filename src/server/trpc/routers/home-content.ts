import "server-only";
import { revalidateTag } from "next/cache";
import { TRPCError } from "@trpc/server";
import { eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { deleteObject, getPresignedUploadUrl, headObject } from "@/core/storage/r2";
import type { db as dbClient } from "@/db";
import { siteSettings } from "@/db/schema/site-settings";
import {
  collectHomeImageKeys,
  HOME_CONTENT_KEYS,
  HOME_CONTENT_SCHEMAS,
  HOME_IMAGE_KEY_PREFIX,
  homeDocumentForKey,
  homeImageKeySchema,
  parseHomeDocument,
  parseHomeRows,
  type HomeContentDocument,
  type HomeContentDocuments,
} from "@/modules/home/lib/home-content";
import { writeAuditLog } from "@/server/lib/audit";
import { HOME_CONTENT_CACHE_TAG, safeHomeImageUrl } from "@/server/lib/home-content";
import { checkRateLimit } from "@/server/lib/rate-limit";
import { getExtension, isContentTypeAllowed, isSizeWithinLimit } from "@/shared/lib/upload-limits";
import { permissionProcedure, router } from "../init";

/** Mesmo balde por usuário dos demais presigns do portal. */
const PRESIGN_RATE_LIMIT = { windowSeconds: 5 * 60, max: 30 };

/**
 * Expiração IMEDIATA (e não `"max"`, stale-while-revalidate): quem edita a home
 * salva e abre o site em seguida — com `"max"` a PRIMEIRA visita ainda
 * mostraria o conteúdo antigo, e a edição pareceria não ter funcionado (spec
 * 001, RF20). A home é editada raramente, então a regeneração bloqueante da
 * próxima visita custa pouco.
 */
const IMMEDIATE_EXPIRY = { expire: 0 };

const documentSchema = z.enum(Object.keys(HOME_CONTENT_KEYS) as [HomeContentDocument, ...HomeContentDocument[]]);

/** União discriminada: cada documento valida contra o SEU schema. */
const updateInputSchema = z.discriminatedUnion("document", [
  z.object({ document: z.literal("layout"), data: HOME_CONTENT_SCHEMAS.layout }),
  z.object({ document: z.literal("facade"), data: HOME_CONTENT_SCHEMAS.facade }),
  z.object({ document: z.literal("about"), data: HOME_CONTENT_SCHEMAS.about }),
  z.object({ document: z.literal("categories"), data: HOME_CONTENT_SCHEMAS.categories }),
  z.object({ document: z.literal("featured"), data: HOME_CONTENT_SCHEMAS.featured }),
  z.object({ document: z.literal("portalCta"), data: HOME_CONTENT_SCHEMAS.portalCta }),
]);

function imageUrlsFor(keys: string[]): Record<string, string> {
  const urls: Record<string, string> = {};
  for (const key of keys) {
    const url = safeHomeImageUrl(key);
    if (url) urls[key] = url;
  }
  return urls;
}

type Database = typeof dbClient;

/** Chaves de imagem referenciadas por QUALQUER documento da home salvo no banco. */
async function referencedHomeImageKeys(db: Database): Promise<Set<string>> {
  const rows = await db
    .select({ key: siteSettings.key, value: siteSettings.value })
    .from(siteSettings)
    .where(inArray(siteSettings.key, Object.values(HOME_CONTENT_KEYS)));
  return new Set(collectHomeImageKeys(parseHomeRows(rows)));
}

/**
 * Apaga do R2 as imagens que deixaram de ser referenciadas. `stillReferenced`
 * vem de TODOS os documentos (não só do que mudou): a mesma chave pode estar
 * na fachada e num card, e apagar ao trocar uma quebraria a outra. Best-effort:
 * falha vira log (prefere-se um órfão no bucket a um save que falha depois de
 * já ter gravado o conteúdo). Só toca chaves do prefixo da home.
 */
async function deleteOrphanImages(candidates: string[], stillReferenced: ReadonlySet<string>) {
  for (const key of candidates) {
    if (stillReferenced.has(key) || !key.startsWith(HOME_IMAGE_KEY_PREFIX)) continue;
    try {
      await deleteObject(key);
    } catch (error) {
      console.error("[homeContent] Falha ao remover imagem órfã do R2.", error);
    }
  }
}

/**
 * Confere o objeto que o navegador subiu e devolve o tamanho: existe, o tipo
 * GRAVADO no R2 (não o declarado no presign) é JPEG/PNG/WebP, bate com a
 * extensão da chave e cabe no teto. A URL presignada não amarra tipo nem
 * tamanho (o presigner não assina `content-type`), então o limite do RNF02 só
 * vale se o servidor olhar o objeto (revisão de segurança 2026-09-30). Objeto
 * fora do contrato é apagado — não fica hospedado no bucket público.
 */
async function verifyStoredImage(key: string): Promise<number> {
  let head: Awaited<ReturnType<typeof headObject>>;
  try {
    head = await headObject(key);
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Imagem não encontrada. Envie o arquivo novamente." });
  }

  const contentType = (head.ContentType ?? "").split(";")[0].trim().toLowerCase();
  const sizeBytes = head.ContentLength ?? 0;
  const keyExtension = key.slice(key.lastIndexOf(".") + 1);
  const valid =
    getExtension("siteImage", contentType) === keyExtension &&
    isSizeWithinLimit("siteImage", contentType, sizeBytes);

  if (!valid) {
    try {
      await deleteObject(key);
    } catch (error) {
      console.error("[homeContent] Falha ao remover upload fora do contrato.", error);
    }
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Arquivo inválido: envie uma imagem JPEG, PNG ou WebP de até 10 MB.",
    });
  }
  return sizeBytes;
}

export const homeContentRouter = router({
  /**
   * Documentos salvos (ou `null` = usando o padrão) + URL pública de cada
   * imagem referenciada, para o editor mostrar preview sem conhecer o bucket.
   */
  get: permissionProcedure("home_content", "read").query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({ key: siteSettings.key, value: siteSettings.value, updatedAt: siteSettings.updatedAt })
      .from(siteSettings)
      .where(inArray(siteSettings.key, Object.values(HOME_CONTENT_KEYS)));

    const documents: HomeContentDocuments = {
      layout: null,
      facade: null,
      about: null,
      categories: null,
      featured: null,
      portalCta: null,
    };
    const updatedAt: Partial<Record<HomeContentDocument, Date>> = {};
    for (const row of rows) {
      const document = homeDocumentForKey(row.key);
      if (!document) continue;
      (documents as Record<HomeContentDocument, unknown>)[document] = parseHomeDocument(document, row.value);
      updatedAt[document] = row.updatedAt;
    }

    return { documents, updatedAt, imageUrls: imageUrlsFor(collectHomeImageKeys(documents)) };
  }),

  /** Salva UM documento (seção ou layout). Upsert por chave; audita; invalida o cache. */
  update: permissionProcedure("home_content", "update")
    .input(updateInputSchema)
    .mutation(async ({ ctx, input }) => {
      const key = HOME_CONTENT_KEYS[input.document];

      const [previousRow] = await ctx.db
        .select({ value: siteSettings.value })
        .from(siteSettings)
        .where(eq(siteSettings.key, key))
        .limit(1);
      const previous = previousRow ? parseHomeDocument(input.document, previousRow.value) : null;

      // Toda imagem NOVA referenciada é conferida no bucket (existe, tipo e
      // tamanho reais). O regex do schema já garante o prefixo/formato; aqui
      // barra a chave inventada e o objeto fora do contrato — o `confirmImage`
      // é opcional para quem chama a API direto, este ponto não.
      const previousKeys = collectHomeImageKeys({ [input.document]: previous });
      const nextKeys = collectHomeImageKeys({ [input.document]: input.data });
      for (const imageKey of nextKeys) {
        if (previousKeys.includes(imageKey)) continue;
        await verifyStoredImage(imageKey);
      }

      const [row] = await ctx.db
        .insert(siteSettings)
        .values({
          key,
          value: input.data,
          type: "json",
          description: `Conteúdo editável da home — ${input.document}`,
          isPublic: true,
          updatedByUserId: ctx.session.user.id,
        })
        .onConflictDoUpdate({
          target: siteSettings.key,
          set: {
            value: input.data,
            type: "json",
            updatedByUserId: ctx.session.user.id,
            updatedAt: sql`now()`,
          },
        })
        .returning({ updatedAt: siteSettings.updatedAt });

      if (!row) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao salvar o conteúdo." });
      }

      await deleteOrphanImages(previousKeys, await referencedHomeImageKeys(ctx.db));

      await writeAuditLog(ctx.db, ctx.session, {
        action: "home_content.update",
        resource: "home_content",
        resourceId: key,
        metadata: { document: input.document },
      });
      revalidateTag(HOME_CONTENT_CACHE_TAG, IMMEDIATE_EXPIRY);

      return { document: input.document, updatedAt: row.updatedAt, imageUrls: imageUrlsFor(nextKeys) };
    }),

  /** Volta um documento ao padrão do dicionário (apaga a linha e as imagens dela). */
  reset: permissionProcedure("home_content", "update")
    .input(z.object({ document: documentSchema }))
    .mutation(async ({ ctx, input }) => {
      const key = HOME_CONTENT_KEYS[input.document];
      const [deleted] = await ctx.db
        .delete(siteSettings)
        .where(eq(siteSettings.key, key))
        .returning({ value: siteSettings.value });

      if (deleted) {
        const previous = parseHomeDocument(input.document, deleted.value);
        await deleteOrphanImages(
          collectHomeImageKeys({ [input.document]: previous }),
          await referencedHomeImageKeys(ctx.db)
        );
      }

      await writeAuditLog(ctx.db, ctx.session, {
        action: "home_content.reset",
        resource: "home_content",
        resourceId: key,
        metadata: { document: input.document },
      });
      revalidateTag(HOME_CONTENT_CACHE_TAG, IMMEDIATE_EXPIRY);
      return { document: input.document, reset: Boolean(deleted) };
    }),

  /** Upload 2-step (presign → PUT no R2 → confirm), mesmo padrão de produtos/hero. */
  presignImage: permissionProcedure("home_content", "update")
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
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Muitas solicitações de upload. Tente novamente em instantes.",
        });
      }

      const extension = getExtension("siteImage", input.contentType);
      if (!extension) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Formato não suportado." });
      }
      const key = `${HOME_IMAGE_KEY_PREFIX}${crypto.randomUUID()}.${extension}`;

      try {
        // Tipo e tamanho ASSINADOS: o PUT só grava exatamente o que foi declarado.
        const uploadUrl = await getPresignedUploadUrl(key, input.contentType, undefined, {
          sizeBytes: input.sizeBytes,
        });
        return { uploadUrl, key };
      } catch (error) {
        console.error("[homeContent.presignImage]", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Armazenamento de imagens indisponível no momento.",
        });
      }
    }),

  confirmImage: permissionProcedure("home_content", "update")
    .input(
      z.object({
        key: homeImageKeySchema.unwrap(),
        filename: z.string().trim().min(1).max(255),
        contentType: z.string().trim().min(1).max(100),
      })
    )
    .mutation(async ({ input }) => {
      if (!isContentTypeAllowed("siteImage", input.contentType)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Formato não suportado." });
      }

      // Tipo e tamanho vêm do objeto GRAVADO, não do que o cliente declarou.
      const sizeBytes = await verifyStoredImage(input.key);

      return { key: input.key, sizeBytes, url: safeHomeImageUrl(input.key) };
    }),
});
