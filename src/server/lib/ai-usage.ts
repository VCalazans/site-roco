import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiUsageDaily, contactSubmissions } from "@/db/schema";
import { mergeEvents, summarizeAiUsage, type AiUsageEvent, type AiUsageTotals } from "@/modules/ai/lib/ai-usage";
import { todayInBrazil } from "@/modules/certifications/lib/certifications";

/** Janela do painel "Uso da IA". */
export const AI_USAGE_WINDOW_DAYS = 30;

/**
 * Soma os eventos no contador do dia (fuso de Brasília). Melhor esforço: falha
 * de banco só vai ao log — métrica nunca derruba o `/mcp` nem uma página. Quem
 * chama usa `after()`, fora do caminho da resposta.
 */
export async function recordAiUsage(events: AiUsageEvent[]): Promise<void> {
  const rows = mergeEvents(events);
  if (rows.length === 0) return;
  const day = todayInBrazil();
  try {
    await db
      .insert(aiUsageDaily)
      .values(rows.map((event) => ({ day, metric: event.metric, key: event.key, count: event.count ?? 1 })))
      .onConflictDoUpdate({
        target: [aiUsageDaily.day, aiUsageDaily.metric, aiUsageDaily.key],
        set: { count: sql`${aiUsageDaily.count} + excluded.count` },
      });
  } catch (error) {
    console.error("[ai-usage] Falha ao registrar uso:", error instanceof Error ? error.message : error);
  }
}

/** Primeiro dia da janela (inclusive), no fuso de Brasília. */
function windowStartDay(days: number): string {
  return todayInBrazil(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));
}

export type AiUsageSummary = AiUsageTotals & {
  windowDays: number;
  /** Solicitações enviadas com a lista montada pela IA (origem `assistente-ia`). */
  aiLeads: number;
};

export async function getAiUsageSummary(days = AI_USAGE_WINDOW_DAYS): Promise<AiUsageSummary> {
  const startDay = windowStartDay(days);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [rows, [{ aiLeads }]] = await Promise.all([
    db
      .select({
        metric: aiUsageDaily.metric,
        key: aiUsageDaily.key,
        total: sql<number>`sum(${aiUsageDaily.count})::int`,
      })
      .from(aiUsageDaily)
      .where(gte(aiUsageDaily.day, startDay))
      .groupBy(aiUsageDaily.metric, aiUsageDaily.key),
    db
      .select({ aiLeads: sql<number>`count(*)::int` })
      .from(contactSubmissions)
      .where(and(eq(contactSubmissions.origin, "assistente-ia"), gte(contactSubmissions.createdAt, since))),
  ]);
  return { ...summarizeAiUsage(rows), windowDays: days, aiLeads };
}
