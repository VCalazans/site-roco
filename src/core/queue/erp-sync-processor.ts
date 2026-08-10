import "server-only";
import { revalidateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { products, syncRuns } from "@/db/schema";
import { slugify } from "@/server/lib/slugify";
import type { ErpSyncJobData } from "./erp-sync-types";

export interface ErpSyncStats {
  created: number;
  updated: number;
  skipped: number;
  fullSync?: "not_implemented";
  reason?: string;
}

const erpProductSchema = z
  .object({
    erpCode: z.string().trim().min(1).max(20).optional(),
    sku: z.string().trim().min(1).max(20).optional(),
    namePt: z.string().trim().min(1).optional(),
    nameEn: z.string().trim().min(1).optional(),
    descriptionPt: z.string().trim().min(1).optional(),
    descriptionEn: z.string().trim().min(1).optional(),
    ncm: z.string().trim().max(8).optional(),
    barcodeEan13: z.string().trim().max(13).optional(),
    published: z.boolean().optional(),
  })
  .refine((data) => Boolean(data.erpCode || data.sku), {
    message: "Item precisa de erpCode ou sku para ser identificado.",
  });

/**
 * Processa um job `erp-sync`: cria a linha em `syncRuns` (running), faz o
 * upsert incremental (ou registra que o full-sync ainda não tem contrato) e
 * fecha a linha (success/error). Relança o erro para o BullMQ acionar
 * retry/DLQ — ver `registerErpSyncWorker`.
 */
export async function processErpSyncJob(data: ErpSyncJobData): Promise<ErpSyncStats> {
  const [run] = await db
    .insert(syncRuns)
    .values({ source: data.triggeredBy, status: "running" })
    .returning({ id: syncRuns.id });

  try {
    const stats = await runSync(data);

    await db
      .update(syncRuns)
      .set({ status: "success", stats, finishedAt: new Date() })
      .where(eq(syncRuns.id, run.id));

    try {
      revalidateTag("products", "max");
    } catch (error) {
      console.error("[queue:erp-sync] revalidateTag('products') falhou (não bloqueante).", error);
    }

    return stats;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido no sync.";
    await db
      .update(syncRuns)
      .set({ status: "error", error: message, finishedAt: new Date() })
      .where(eq(syncRuns.id, run.id));
    throw error;
  }
}

async function runSync(data: ErpSyncJobData): Promise<ErpSyncStats> {
  if (!data.products || data.products.length === 0) {
    return {
      created: 0,
      updated: 0,
      skipped: 0,
      fullSync: "not_implemented",
      reason:
        "Full-sync (sem payload no job) aguarda o contrato definitivo do ERP — só o upsert " +
        "incremental via webhook/payload está implementado nesta onda.",
    };
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const rawItem of data.products) {
    const parsed = erpProductSchema.safeParse(rawItem);
    if (!parsed.success) {
      skipped++;
      continue;
    }

    const item = parsed.data;

    try {
      const [existing] = item.erpCode
        ? await db.select({ id: products.id }).from(products).where(eq(products.erpCode, item.erpCode)).limit(1)
        : await db.select({ id: products.id }).from(products).where(eq(products.sku, item.sku!)).limit(1);

      const patch: Partial<typeof products.$inferInsert> = {};
      if (item.namePt !== undefined) patch.namePt = item.namePt;
      if (item.nameEn !== undefined) patch.nameEn = item.nameEn;
      if (item.descriptionPt !== undefined) patch.descriptionPt = item.descriptionPt;
      if (item.descriptionEn !== undefined) patch.descriptionEn = item.descriptionEn;
      if (item.ncm !== undefined) patch.ncm = item.ncm;
      if (item.barcodeEan13 !== undefined) patch.barcodeEan13 = item.barcodeEan13;
      if (item.published !== undefined) patch.published = item.published;

      if (existing) {
        if (Object.keys(patch).length > 0) {
          await db
            .update(products)
            .set({ ...patch, updatedAt: new Date() })
            .where(eq(products.id, existing.id));
        }
        updated++;
        continue;
      }

      if (!item.sku) {
        // Produto novo sem sku conhecido: não há como criar (sku é obrigatório/único).
        skipped++;
        continue;
      }

      await db.insert(products).values({
        sku: item.sku,
        erpCode: item.erpCode ?? null,
        slug: slugify(item.namePt ?? item.sku) || item.sku,
        namePt: item.namePt ?? item.sku,
        nameEn: item.nameEn ?? null,
        descriptionPt: item.descriptionPt ?? null,
        descriptionEn: item.descriptionEn ?? null,
        ncm: item.ncm ?? null,
        barcodeEan13: item.barcodeEan13 ?? null,
        published: item.published ?? false,
      });
      created++;
    } catch (error) {
      console.error("[queue:erp-sync] Falha ao processar item — pulando.", error);
      skipped++;
    }
  }

  return { created, updated, skipped };
}
