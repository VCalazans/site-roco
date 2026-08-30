import "server-only";
import { revalidateTag } from "next/cache";
import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db as dbClient } from "@/db";
import {
  ALL_PUBLIC_SETTING_KEYS,
  SITE_SETTING_CATALOG_PDF_URL,
  SITE_SETTING_CONTACT_EMAIL,
  SITE_SETTING_CONTACT_PHONE,
  SITE_SETTING_CONTACT_ADDRESS_MATRIZ,
  SITE_SETTING_CONTACT_ADDRESS_FILIAL,
  SITE_SETTING_SOCIAL_LINKS,
  siteSettings,
} from "@/db/schema/site-settings";
import { writeAuditLog } from "@/server/lib/audit";
import { permissionProcedure, router } from "../init";

const SETTING_KEYS = ALL_PUBLIC_SETTING_KEYS;
const settingKeySchema = z.enum(SETTING_KEYS);

const settingValueSchema = z.object({
  key: settingKeySchema,
  value: z.string().trim().min(1).max(2000),
  type: z.literal("string"),
  description: z.string().trim().max(500).optional().nullable(),
});

export const siteSettingsRouter = router({
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
