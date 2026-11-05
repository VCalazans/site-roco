import "server-only";
import { revalidateTag } from "next/cache";
import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { deleteObject, getPresignedUploadUrl, headObject } from "@/core/storage/r2";
import { db as dbClient } from "@/db";
import {
  ALL_PUBLIC_SETTING_KEYS,
  SITE_SETTING_CATALOG_FILE,
  SITE_SETTING_CATALOG_PDF_URL,
  SITE_SETTING_CONTACT_EMAIL,
  SITE_SETTING_CONTACT_PHONE,
  SITE_SETTING_CONTACT_ADDRESS_MATRIZ,
  SITE_SETTING_CONTACT_ADDRESS_FILIAL,
  SITE_SETTING_SOCIAL_LINKS,
  siteSettings,
} from "@/db/schema/site-settings";
import {
  CATALOG_FILE_KEY_PREFIX,
  isCatalogFileKey,
  parseCatalogFile,
  type CatalogFile,
} from "@/modules/catalog/lib/catalog-file";
import { writeAuditLog } from "@/server/lib/audit";
import { checkRateLimit } from "@/server/lib/rate-limit";
import { getExtension, isContentTypeAllowed, isSizeWithinLimit } from "@/shared/lib/upload-limits";
import { permissionProcedure, router } from "../init";

const SETTING_KEYS = ALL_PUBLIC_SETTING_KEYS;
const settingKeySchema = z.enum(SETTING_KEYS);

const settingValueSchema = z.object({
  key: settingKeySchema,
  value: z.string().trim().min(1).max(2000),
  type: z.literal("string"),
  description: z.string().trim().max(500).optional().nullable(),
});

const PRESIGN_RATE_LIMIT = { windowSeconds: 5 * 60, max: 30 };

async function readCatalogFile(): Promise<CatalogFile | null> {
  const [row] = await dbClient
    .select({ value: siteSettings.value })
    .from(siteSettings)
    .where(eq(siteSettings.key, SITE_SETTING_CATALOG_FILE))
    .limit(1);
  return row ? parseCatalogFile(JSON.stringify(row.value)) : null;
}

/** Confere o objeto GRAVADO (tipo e tamanho); fora do contrato, apaga e recusa. */
async function verifyStoredCatalog(key: string): Promise<number> {
  let head: Awaited<ReturnType<typeof headObject>>;
  try {
    head = await headObject(key);
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Arquivo não encontrado. Envie o catálogo novamente." });
  }
  const contentType = (head.ContentType ?? "").split(";")[0].trim().toLowerCase();
  const sizeBytes = head.ContentLength ?? 0;
  if (!isSizeWithinLimit("catalogPdf", contentType, sizeBytes)) {
    await deleteObject(key).catch(() => undefined);
    throw new TRPCError({ code: "BAD_REQUEST", message: "Arquivo inválido: envie um PDF de até 95 MB." });
  }
  return sizeBytes;
}

export const siteSettingsRouter = router({
  /** Catálogo em PDF em uso no site; `null` enquanto ninguém enviou. */
  catalogFile: permissionProcedure("users", "manage").query(() => readCatalogFile()),

  presignCatalogFile: permissionProcedure("users", "manage")
    .input(
      z
        .object({
          filename: z.string().trim().min(1).max(255),
          contentType: z.string().trim().min(1).max(100),
          sizeBytes: z.number().int().positive(),
        })
        .superRefine((data, ctx) => {
          if (!isSizeWithinLimit("catalogPdf", data.contentType, data.sizeBytes)) {
            ctx.addIssue({
              code: "custom",
              path: [isContentTypeAllowed("catalogPdf", data.contentType) ? "sizeBytes" : "contentType"],
              message: "Envie um PDF de até 95 MB.",
            });
          }
        })
    )
    .mutation(async ({ ctx, input }) => {
      const rateLimit = await checkRateLimit(`presign:user:${ctx.session.user.id}`, PRESIGN_RATE_LIMIT);
      if (!rateLimit.allowed) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Muitas solicitações de upload. Tente novamente em instantes." });
      }
      const key = `${CATALOG_FILE_KEY_PREFIX}${crypto.randomUUID()}.${getExtension("catalogPdf", input.contentType)}`;
      try {
        // Tipo e tamanho ASSINADOS: o PUT só grava exatamente o que foi declarado.
        const uploadUrl = await getPresignedUploadUrl(key, input.contentType, undefined, { sizeBytes: input.sizeBytes });
        return { uploadUrl, key };
      } catch (error) {
        console.error("[siteSettings.presignCatalogFile]", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Armazenamento de arquivos indisponível no momento." });
      }
    }),

  /** Publica o arquivo enviado: vale na hora no site, e o anterior é apagado. */
  confirmCatalogFile: permissionProcedure("users", "manage")
    .input(
      z.object({
        key: z.string().refine(isCatalogFileKey, "Arquivo inválido."),
        filename: z.string().trim().min(1).max(255),
        contentType: z.string().trim().min(1).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const sizeBytes = await verifyStoredCatalog(input.key);
      const previous = await readCatalogFile();
      const file: CatalogFile = {
        key: input.key,
        filename: input.filename,
        sizeBytes,
        updatedAt: new Date().toISOString(),
      };

      await dbClient
        .insert(siteSettings)
        .values({
          key: SITE_SETTING_CATALOG_FILE,
          value: file,
          type: "json",
          isPublic: true,
          updatedByUserId: ctx.session.user.id,
        })
        .onConflictDoUpdate({
          target: siteSettings.key,
          set: { value: file, updatedByUserId: ctx.session.user.id, updatedAt: sql`now()` },
        });

      await writeAuditLog(ctx.db, ctx.session, {
        action: "site_settings.catalog_file",
        resource: "site_settings",
        resourceId: SITE_SETTING_CATALOG_FILE,
        metadata: { filename: file.filename, sizeBytes },
      });
      revalidateTag("site-settings", { expire: 0 });

      if (previous && previous.key !== file.key) {
        await deleteObject(previous.key).catch((error) =>
          console.error("[siteSettings.confirmCatalogFile] Falha ao apagar o catálogo anterior.", error)
        );
      }
      return file;
    }),

  /** Lista as configurações públicas editáveis (admin + sales_manager). */
  list: permissionProcedure("users", "manage").query(async () => {
    const rows = await dbClient
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.isPublic, true));
    // Serializa `value` como string quando `type === "string"` (camada de
    // apresentação — o storage é jsonb para flexibilidade futura).
    return rows.map((row) => ({
      key: row.key,
      value: typeof row.value === "string" ? row.value : JSON.stringify(row.value),
      type: row.type,
      description: row.description,
      updatedAt: row.updatedAt,
    }));
  }),

  /** Cria/atualiza uma configuração (idempotente por `key`). */
  set: permissionProcedure("users", "manage")
    .input(settingValueSchema)
    .mutation(async ({ ctx, input }) => {
      const [row] = await dbClient
        .insert(siteSettings)
        .values({
          key: input.key,
          value: input.value,
          type: input.type,
          description: input.description ?? null,
          isPublic: true,
          updatedByUserId: ctx.session.user.id,
        })
        .onConflictDoUpdate({
          target: siteSettings.key,
          set: {
            value: input.value,
            type: input.type,
            description: input.description ?? null,
            updatedByUserId: ctx.session.user.id,
            updatedAt: sql`now()`,
          },
        })
        .returning();

      if (!row) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao salvar configuração." });
      }
      await writeAuditLog(ctx.db, ctx.session, {
        action: "site_settings.set",
        resource: "site_settings",
        resourceId: row.key,
        metadata: { key: row.key },
      });
      revalidateTag("site-settings", "max");
      return row;
    }),
});
