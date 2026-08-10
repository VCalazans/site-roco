import "server-only";
import type { Session } from "next-auth";
import { auditLogs } from "@/db/schema";
import type { db as dbClient } from "@/db";

type Database = typeof dbClient;

/**
 * Registra uma linha de auditoria para mutações sensíveis (produtos,
 * representantes). `metadata` deve ser um resumo (ids/diff de chaves), nunca
 * o payload bruto — evita gravar dados desnecessários/sensíveis no log.
 */
export async function writeAuditLog(
  db: Database,
  session: Session,
  entry: { action: string; resource: string; resourceId?: string | null; metadata?: unknown }
): Promise<void> {
  await db.insert(auditLogs).values({
    userId: session.user.id,
    action: entry.action,
    resource: entry.resource,
    resourceId: entry.resourceId ?? null,
    metadata: entry.metadata ?? null,
  });
}
