import "server-only";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getPresignedDownloadUrl, getPresignedUploadUrl, headObject } from "@/core/storage/r2";
import { isValidCNPJ } from "@/shared/components/contact-form/cnpj";
import type { db as dbClient } from "@/db";
import {
  representativeDocuments,
  representativeStatusEnum,
  representatives,
  roles,
  userRoles,
  users,
} from "@/db/schema";
import { writeAuditLog } from "@/server/lib/audit";
import { translateDbError } from "@/server/lib/db-error";
import { checkRateLimit } from "@/server/lib/rate-limit";
import { permissionProcedure, protectedProcedure, router } from "../init";

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;
const CONTENT_TYPE_EXTENSION: Record<(typeof ALLOWED_DOCUMENT_TYPES)[number], string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

const REPRESENTATIVE_ROLE_SLUG = "representative";

/** Rascunho/pendente: ainda editável pelo próprio representante. */
const EDITABLE_STATUSES = new Set(["draft", "rejected"]);

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;

/** Compartilhado com `products.presignImageUpload` — mesmo balde por usuário. */
const PRESIGN_RATE_LIMIT = { windowSeconds: 5 * 60, max: 30 };

const onboardingDataSchema = z.object({
  companyName: z.string().trim().min(1).max(200).optional(),
  cnpj: z.string().trim().max(18).optional(),
  phone: z.string().trim().min(1).max(30).optional(),
  region: z.string().trim().min(1).max(120).optional(),
  notes: z.string().trim().max(2000).optional(),
});

type Database = typeof dbClient;

/** URL de leitura temporária tolerante a R2 não configurado (dev). */
async function safeDownloadUrl(key: string): Promise<string> {
  try {
    return await getPresignedDownloadUrl(key);
  } catch (error) {
    console.error("[representatives] Falha ao gerar URL de leitura do documento.", error);
    return "";
  }
}

async function getOwnRepresentative(db: Database, userId: string) {
  const [representative] = await db
    .select()
    .from(representatives)
    .where(eq(representatives.userId, userId))
    .limit(1);
  return representative ?? null;
}

export const representativesRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const representative = await getOwnRepresentative(ctx.db, ctx.session.user.id);
    if (!representative) {
      return null;
    }

    const documents = await ctx.db
      .select()
      .from(representativeDocuments)
      .where(eq(representativeDocuments.representativeId, representative.id));

    return {
      ...representative,
      documents,
      notesFromReviewer: representative.reviewNotes,
    };
  }),

  saveOnboarding: protectedProcedure
    .input(z.object({ step: z.number().int().min(0).max(20), data: onboardingDataSchema }))
    .mutation(async ({ ctx, input }) => {
      const existing = await getOwnRepresentative(ctx.db, ctx.session.user.id);

      if (existing && !EDITABLE_STATUSES.has(existing.status)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Cadastro já enviado para análise — não é possível editar.",
        });
      }

      const nextStep = Math.max(existing?.onboardingStep ?? 0, input.step);
      const patch = {
        companyName: input.data.companyName ?? existing?.companyName ?? null,
        cnpj: input.data.cnpj ?? existing?.cnpj ?? null,
        phone: input.data.phone ?? existing?.phone ?? null,
        region: input.data.region ?? existing?.region ?? null,
        notes: input.data.notes ?? existing?.notes ?? null,
      };

      try {
        const [saved] = await ctx.db
          .insert(representatives)
          .values({
            userId: ctx.session.user.id,
            status: "draft",
            onboardingStep: nextStep,
            ...patch,
          })
          .onConflictDoUpdate({
            target: representatives.userId,
            set: { onboardingStep: nextStep, status: "draft", updatedAt: new Date(), ...patch },
          })
          .returning();

        return saved;
      } catch (error) {
        throw translateDbError(error, "Falha ao salvar o cadastro.");
      }
    }),

  submitOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
    const existing = await getOwnRepresentative(ctx.db, ctx.session.user.id);
    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Nenhum cadastro em andamento." });
    }
    if (!EDITABLE_STATUSES.has(existing.status)) {
      throw new TRPCError({ code: "CONFLICT", message: "Cadastro já enviado para análise." });
    }
    if (!existing.companyName || !existing.phone || !existing.cnpj) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Preencha razão social, telefone e CNPJ antes de enviar.",
      });
    }
    if (!isValidCNPJ(existing.cnpj)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "CNPJ inválido." });
    }

    const now = new Date();
    const [updated] = await ctx.db
      .update(representatives)
      .set({ status: "submitted", submittedAt: now, updatedAt: now })
      .where(eq(representatives.id, existing.id))
      .returning();

    await writeAuditLog(ctx.db, ctx.session, {
      action: "representatives.submit",
      resource: "representatives",
      resourceId: existing.id,
    });

    return updated;
  }),

  presignDocumentUpload: protectedProcedure
    .input(
      z.object({
        filename: z.string().trim().min(1).max(255),
        contentType: z.enum(ALLOWED_DOCUMENT_TYPES),
        sizeBytes: z.number().int().positive().max(MAX_DOCUMENT_BYTES),
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

      const existing = await getOwnRepresentative(ctx.db, ctx.session.user.id);
      if (!existing || !EDITABLE_STATUSES.has(existing.status)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Nenhum cadastro editável encontrado para anexar documentos.",
        });
      }

      const extension = CONTENT_TYPE_EXTENSION[input.contentType];
      const key = `representatives/${ctx.session.user.id}/${crypto.randomUUID()}.${extension}`;

      let uploadUrl: string;
      try {
        uploadUrl = await getPresignedUploadUrl(key, input.contentType);
      } catch (error) {
        console.error("[representatives.presignDocumentUpload]", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Armazenamento de documentos indisponível no momento.",
        });
      }

      return { uploadUrl, key };
    }),

  confirmDocumentUpload: protectedProcedure
    .input(
      z.object({
        key: z.string().trim().min(1),
        filename: z.string().trim().min(1).max(255),
        contentType: z.enum(ALLOWED_DOCUMENT_TYPES),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await getOwnRepresentative(ctx.db, ctx.session.user.id);
      if (!existing || !EDITABLE_STATUSES.has(existing.status)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Nenhum cadastro editável encontrado para anexar documentos.",
        });
      }

      if (!input.key.startsWith(`representatives/${ctx.session.user.id}/`)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Referência de upload inválida." });
      }

      let sizeBytes: number;
      try {
        const head = await headObject(input.key);
        sizeBytes = head.ContentLength ?? 0;
      } catch (error) {
        console.error("[representatives.confirmDocumentUpload]", error);
        throw new TRPCError({ code: "BAD_REQUEST", message: "Upload não encontrado ou expirado." });
      }

      if (sizeBytes <= 0 || sizeBytes > MAX_DOCUMENT_BYTES) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Arquivo inválido (tamanho)." });
      }

      const [document] = await ctx.db
        .insert(representativeDocuments)
        .values({
          representativeId: existing.id,
          r2Key: input.key,
          filename: input.filename,
          contentType: input.contentType,
          sizeBytes,
        })
        .returning();

      await writeAuditLog(ctx.db, ctx.session, {
        action: "representatives.document_upload",
        resource: "representatives",
        resourceId: existing.id,
        metadata: { filename: input.filename, sizeBytes },
      });

      return document;
    }),

  list: permissionProcedure("representatives", "read")
    .input(
      z.object({
        status: z.enum(representativeStatusEnum.enumValues).optional(),
        page: z.number().int().min(1).default(DEFAULT_PAGE),
        perPage: z.number().int().min(1).max(MAX_PER_PAGE).default(DEFAULT_PER_PAGE),
      })
    )
    .query(async ({ ctx, input }) => {
      const { status, page, perPage } = input;
      const conditions = status ? [eq(representatives.status, status)] : [];
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [rows, [countRow]] = await Promise.all([
        ctx.db
          .select({
            id: representatives.id,
            status: representatives.status,
            companyName: representatives.companyName,
            region: representatives.region,
            submittedAt: representatives.submittedAt,
            createdAt: representatives.createdAt,
            userName: users.name,
            userEmail: users.email,
          })
          .from(representatives)
          .innerJoin(users, eq(users.id, representatives.userId))
          .where(whereClause)
          .orderBy(desc(representatives.updatedAt))
          .limit(perPage)
          .offset((page - 1) * perPage),
        ctx.db.select({ total: sql<number>`count(*)::int` }).from(representatives).where(whereClause),
      ]);

      const total = countRow?.total ?? 0;

      if (rows.length === 0) {
        return { items: [], total, page, perPage };
      }

      const documentRows = await ctx.db
        .select()
        .from(representativeDocuments)
        .where(
          inArray(
            representativeDocuments.representativeId,
            rows.map((row) => row.id)
          )
        );

      const documentsByRepresentative = new Map<string, (typeof documentRows)[number][]>();
      for (const document of documentRows) {
        const list = documentsByRepresentative.get(document.representativeId) ?? [];
        list.push(document);
        documentsByRepresentative.set(document.representativeId, list);
      }

      const items = await Promise.all(
        rows.map(async ({ userName, userEmail, ...row }) => ({
          ...row,
          user: { name: userName, email: userEmail },
          documents: await Promise.all(
            (documentsByRepresentative.get(row.id) ?? []).map(async (document) => ({
              id: document.id,
              filename: document.filename,
              url: await safeDownloadUrl(document.r2Key),
            }))
          ),
        }))
      );

      return { items, total, page, perPage };
    }),

  /** Uma query agregada (FILTER por status) para os cards do dashboard. */
  stats: permissionProcedure("representatives", "read").query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select({
        total: sql<number>`count(*)::int`,
        draft: sql<number>`count(*) filter (where ${representatives.status} = 'draft')::int`,
        submitted: sql<number>`count(*) filter (where ${representatives.status} = 'submitted')::int`,
        approved: sql<number>`count(*) filter (where ${representatives.status} = 'approved')::int`,
        rejected: sql<number>`count(*) filter (where ${representatives.status} = 'rejected')::int`,
      })
      .from(representatives);

    return row ?? { total: 0, draft: 0, submitted: 0, approved: 0, rejected: 0 };
  }),

  review: permissionProcedure("representatives", "review")
    .input(
      z.object({
        id: z.string().uuid(),
        decision: z.enum(["approved", "rejected"]),
        notes: z.string().trim().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(representatives)
        .where(eq(representatives.id, input.id))
        .limit(1);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cadastro não encontrado." });
      }

      // Conflito de interesse: quem tem `representatives:review` ainda pode ter
      // um cadastro próprio — a aprovação precisa vir de um terceiro.
      if (existing.userId === ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Não é permitido revisar o próprio cadastro.",
        });
      }

      const [updated] = await ctx.db
        .update(representatives)
        .set({
          status: input.decision,
          reviewNotes: input.notes ?? existing.reviewNotes,
          reviewedBy: ctx.session.user.id,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(representatives.id, input.id))
        .returning();

      if (input.decision === "approved") {
        const [representativeRole] = await ctx.db
          .select({ id: roles.id })
          .from(roles)
          .where(eq(roles.slug, REPRESENTATIVE_ROLE_SLUG))
          .limit(1);

        if (representativeRole) {
          await ctx.db
            .insert(userRoles)
            .values({ userId: existing.userId, roleId: representativeRole.id })
            .onConflictDoNothing();
        }
      }

      await writeAuditLog(ctx.db, ctx.session, {
        action: "representatives.review",
        resource: "representatives",
        resourceId: input.id,
        metadata: { decision: input.decision },
      });

      return updated;
    }),
});
