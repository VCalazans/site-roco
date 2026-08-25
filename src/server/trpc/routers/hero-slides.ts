import "server-only";
import { revalidateTag } from "next/cache";
import { TRPCError } from "@trpc/server";
import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  deleteObject,
  getPresignedUploadUrl,
  getPublicUrl,
  headObject,
} from "@/core/storage/r2";
import { db as dbClient } from "@/db";
import {
  heroSlideKindEnum,
  heroSlides,
  type HeroSlide,
} from "@/db/schema/hero-slides";
import { writeAuditLog } from "@/server/lib/audit";
import {
  getExtension,
  isContentTypeAllowed,
  isSizeWithinLimit,
  type UploadField,
} from "@/shared/lib/upload-limits";
import { permissionProcedure, router } from "../init";

const MAX_HERO_SLIDES = Number(process.env.MAX_HERO_SLIDES ?? 20);

function safePublicUrl(key: string): string | null {
  try {
    return getPublicUrl(key);
  } catch {
    return null;
  }
}

const slideInputSchema = z.object({
  slug: z.string().trim().min(1).max(80).optional(),
  kind: z.enum(heroSlideKindEnum),
  youtubeId: z.string().trim().min(1).max(32).optional().nullable(),
  r2Key: z.string().trim().min(1).optional().nullable(),
  r2PosterKey: z.string().trim().min(1).optional().nullable(),
  eyebrowPt: z.string().trim().max(120).optional().nullable(),
  eyebrowEn: z.string().trim().max(120).optional().nullable(),
  headlinePt: z.string().trim().min(1).max(120),
  headlineEn: z.string().trim().max(120).optional().nullable(),
  descriptionPt: z.string().trim().max(500).optional().nullable(),
  descriptionEn: z.string().trim().max(500).optional().nullable(),
  primaryCtaLabelPt: z.string().trim().max(60).optional().nullable(),
  primaryCtaLabelEn: z.string().trim().max(60).optional().nullable(),
  primaryCtaHref: z.string().trim().max(500).optional().nullable(),
  secondaryCtaLabelPt: z.string().trim().max(60).optional().nullable(),
  secondaryCtaLabelEn: z.string().trim().max(60).optional().nullable(),
  secondaryCtaHref: z.string().trim().max(500).optional().nullable(),
  loopWindowStartSeconds: z.number().int().min(0).optional().nullable(),
  loopWindowEndSeconds: z.number().int().min(0).optional().nullable(),
  /** Carrossel: 0 ou null = sem rotação automática; max 60s (limite
   *  defensivo — UI sugere 5–15s). Crossfade entre slides no client. */
  autoAdvanceSeconds: z.number().int().min(0).max(60).optional().nullable(),
  muted: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(1000).default(0),
  published: z.boolean().default(false),
  startsAt: z.coerce.date().optional().nullable(),
  endsAt: z.coerce.date().optional().nullable(),
});

function ensureKindMatches(input: z.infer<typeof slideInputSchema>): void {
  if (input.kind === "youtube") {
    if (!input.youtubeId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Slide do YouTube exige `youtubeId`.",
      });
    }
    if (input.r2Key || input.r2PosterKey) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Slide do YouTube não deve ter `r2Key`/`r2PosterKey`.",
      });
    }
  } else {
    if (!input.r2Key) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Slide de upload exige `r2Key`.",
      });
    }
  }
  if (
    (input.loopWindowStartSeconds != null && input.loopWindowEndSeconds == null) ||
    (input.loopWindowStartSeconds == null && input.loopWindowEndSeconds != null)
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Janela de loop exige ambos `start` e `end` em segundos.",
    });
  }
}

export const heroSlidesRouter = router({
  /** Lista TODOS os slides (inclui não publicados) — admin only. */
  list: permissionProcedure("hero_slides", "read").query(async () => {
    const rows: HeroSlide[] = await dbClient
      .select()
      .from(heroSlides)
      .orderBy(asc(heroSlides.sortOrder), asc(heroSlides.createdAt));
    // Inclui `videoUrl` resolvido para a UI poder mostrar preview sem montar.
    return rows.map((row) => ({
      ...row,
      videoUrl: row.kind === "upload" ? safePublicUrl(row.r2Key ?? "") : null,
      posterUrl: safePublicUrl(row.r2PosterKey ?? ""),
    }));
  }),

  /** Cria novo slide. */
  create: permissionProcedure("hero_slides", "create")
    .input(slideInputSchema)
    .mutation(async ({ ctx, input }) => {
      ensureKindMatches(input);

      const count = await dbClient
        .select({ value: sql<number>`count(*)::int` })
        .from(heroSlides);
      if ((count[0]?.value ?? 0) >= MAX_HERO_SLIDES) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Limite de ${MAX_HERO_SLIDES} slides atingido (defina MAX_HERO_SLIDES para ajustar).`,
        });
      }

      const [row] = await dbClient
        .insert(heroSlides)
        .values({
          slug: input.slug ?? input.headlinePt.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80),
          kind: input.kind,
          youtubeId: input.youtubeId ?? null,
          r2Key: input.r2Key ?? null,
          r2PosterKey: input.r2PosterKey ?? null,
          eyebrowPt: input.eyebrowPt ?? null,
          eyebrowEn: input.eyebrowEn ?? null,
          headlinePt: input.headlinePt,
          headlineEn: input.headlineEn ?? null,
          descriptionPt: input.descriptionPt ?? null,
          descriptionEn: input.descriptionEn ?? null,
          primaryCtaLabelPt: input.primaryCtaLabelPt ?? null,
          primaryCtaLabelEn: input.primaryCtaLabelEn ?? null,
          primaryCtaHref: input.primaryCtaHref ?? null,
          secondaryCtaLabelPt: input.secondaryCtaLabelPt ?? null,
          secondaryCtaLabelEn: input.secondaryCtaLabelEn ?? null,
          secondaryCtaHref: input.secondaryCtaHref ?? null,
          loopWindowStartSeconds: input.loopWindowStartSeconds ?? null,
          loopWindowEndSeconds: input.loopWindowEndSeconds ?? null,
          autoAdvanceSeconds: input.autoAdvanceSeconds ?? null,
          muted: input.muted,
          sortOrder: input.sortOrder,
          published: input.published,
          startsAt: input.startsAt ?? null,
          endsAt: input.endsAt ?? null,
          createdByUserId: ctx.session.user.id,
        })
        .returning();
      if (!row) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao criar slide." });
      }

      await writeAuditLog(ctx.db, ctx.session, {
        action: "hero_slides.create",
        resource: "hero_slides",
        resourceId: row.id,
      });
      revalidateTag("hero", "max");
      return row;
    }),

  /** Edita slide existente. */
  update: permissionProcedure("hero_slides", "update")
    .input(slideInputSchema.partial().extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...patch } = input;
      const [existing] = await dbClient
        .select()
        .from(heroSlides)
        .where(eq(heroSlides.id, id))
        .limit(1);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Slide não encontrado." });
      }

      // Cruzar `kind` com a mídia disponível na combinação resultante.
      const nextKind = patch.kind ?? existing.kind;
      if (nextKind === "youtube") {
        if (patch.r2Key !== undefined && patch.r2Key !== null) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Slide do YouTube não pode ter `r2Key`.",
          });
        }
      } else if (!patch.r2Key && !existing.r2Key) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Slide de upload precisa de `r2Key`.",
        });
      }

      const [row] = await dbClient
        .update(heroSlides)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(heroSlides.id, id))
        .returning();
      if (!row) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao atualizar slide." });
      }

      await writeAuditLog(ctx.db, ctx.session, {
        action: "hero_slides.update",
        resource: "hero_slides",
        resourceId: id,
      });
      revalidateTag("hero", "max");
      return row;
    }),

  /** Reordena — recebe a nova sequência de IDs. */
  reorder: permissionProcedure("hero_slides", "update")
    .input(z.object({ orderedIds: z.array(z.string().uuid()).min(1).max(MAX_HERO_SLIDES) }))
    .mutation(async ({ ctx, input }) => {
      await Promise.all(
        input.orderedIds.map((id, index) =>
          dbClient
            .update(heroSlides)
            .set({ sortOrder: index, updatedAt: new Date() })
            .where(eq(heroSlides.id, id))
        )
      );
      await writeAuditLog(ctx.db, ctx.session, {
        action: "hero_slides.reorder",
        resource: "hero_slides",
      });
      revalidateTag("hero", "max");
      return { ok: true as const };
    }),

  /** Exclui (e tenta apagar o objeto do R2 se for upload). */
  delete: permissionProcedure("hero_slides", "delete")
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [slide] = await dbClient
        .select()
        .from(heroSlides)
        .where(eq(heroSlides.id, input.id))
        .limit(1);
      if (!slide) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Slide não encontrado." });
      }
      // Apaga vídeo/poster do R2 (se for upload). Falha não bloqueia a
      // exclusão do registro — preferir orfãos no bucket a "slide fantasma".
      if (slide.kind === "upload") {
        try {
          if (slide.r2Key) await deleteObject(slide.r2Key);
        } catch (error) {
          console.error("[heroSlides.delete] Falha ao remover vídeo do R2.", error);
        }
        try {
          if (slide.r2PosterKey) await deleteObject(slide.r2PosterKey);
        } catch (error) {
          console.error("[heroSlides.delete] Falha ao remover pôster do R2.", error);
        }
      }
      await dbClient.delete(heroSlides).where(eq(heroSlides.id, input.id));
      await writeAuditLog(ctx.db, ctx.session, {
        action: "hero_slides.delete",
        resource: "hero_slides",
        resourceId: input.id,
      });
      revalidateTag("hero", "max");
      return { ok: true as const };
    }),

  /**
   * 2-step upload: presign → PUT → confirm. Mesmo padrão de produtos.
   *
   * O `contentType`/teto de tamanho aceito depende do campo (`poster`):
   * pôster aceita imagem (JPEG/PNG/WebP, 10 MB), vídeo aceita MP4/WebM
   * (200 MB) — bug corrigido 2026-08-24 (antes os dois caminhos validavam
   * contra os tipos de VÍDEO mesmo para o campo de pôster, tornando
   * impossível fazer upload de um pôster). Ver `@/shared/lib/upload-limits`.
   */
  presignUpload: permissionProcedure("hero_slides", "create")
    .input(
      z
        .object({
          filename: z.string().trim().min(1).max(255),
          contentType: z.string().trim().min(1).max(100),
          sizeBytes: z.number().int().positive(),
          /** Se `poster`=true, vai para `hero/posters/...` e valida como
           *  imagem; senão `hero/videos/...` e valida como vídeo. */
          poster: z.boolean().default(false),
        })
        .superRefine((data, ctx) => {
          const field: UploadField = data.poster ? "heroPoster" : "heroVideo";
          if (!isContentTypeAllowed(field, data.contentType)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["contentType"],
              message: data.poster
                ? "Tipo de arquivo inválido para pôster (aceita JPEG/PNG/WebP)."
                : "Tipo de arquivo inválido para vídeo (aceita MP4/WebM).",
            });
            return;
          }
          if (!isSizeWithinLimit(field, data.contentType, data.sizeBytes)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["sizeBytes"],
              message: "Arquivo excede o tamanho máximo permitido para este campo.",
            });
          }
        })
    )
    .mutation(async ({ input }) => {
      const field: UploadField = input.poster ? "heroPoster" : "heroVideo";
      const extension = getExtension(field, input.contentType);
      if (!extension) {
        // Defensivo: o `superRefine` do input já bloqueia isto antes de
        // chegar aqui, mas nunca gerar uma chave `hero/…/{uuid}.null`.
        throw new TRPCError({ code: "BAD_REQUEST", message: "Tipo de arquivo não suportado." });
      }
      const subfolder = input.poster ? "posters" : "videos";
      const key = `hero/${subfolder}/${crypto.randomUUID()}.${extension}`;

      let uploadUrl: string;
      try {
        uploadUrl = await getPresignedUploadUrl(key, input.contentType);
      } catch (error) {
        console.error("[heroSlides.presignUpload]", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Armazenamento de mídia indisponível no momento.",
        });
      }
      return { uploadUrl, key };
    }),

  confirmUpload: permissionProcedure("hero_slides", "create")
    .input(
      z.object({
        key: z.string().trim().min(1),
        filename: z.string().trim().min(1).max(255),
        contentType: z.string().trim().min(1).max(100),
        poster: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const field: UploadField = input.poster ? "heroPoster" : "heroVideo";
      if (!isContentTypeAllowed(field, input.contentType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: input.poster
            ? "Tipo de arquivo inválido para pôster (aceita JPEG/PNG/WebP)."
            : "Tipo de arquivo inválido para vídeo (aceita MP4/WebM).",
        });
      }

      // Whitelist: chave precisa estar dentro do subfolder correspondente
      // ao campo declarado (evita confirmar um pôster como vídeo ou vice-versa).
      const expectedPrefix = input.poster ? "hero/posters/" : "hero/videos/";
      if (!input.key.startsWith(expectedPrefix)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Referência de upload inválida." });
      }

      let sizeBytes: number;
      try {
        const head = await headObject(input.key);
        sizeBytes = head.ContentLength ?? 0;
      } catch (error) {
        console.error("[heroSlides.confirmUpload]", error);
        throw new TRPCError({ code: "BAD_REQUEST", message: "Upload não encontrado ou expirado." });
      }
      if (!isSizeWithinLimit(field, input.contentType, sizeBytes)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Arquivo inválido (tamanho)." });
      }
      return { key: input.key, sizeBytes };
    }),
});
