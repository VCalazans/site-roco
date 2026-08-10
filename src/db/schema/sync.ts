/**
 * Histórico de execuções do sync de produtos com o ERP (fila `erp-sync`,
 * ver `src/core/queue`). Uma linha por job processado — trigger manual
 * (tRPC `sync.trigger`) ou webhook (`/api/webhooks/erp`).
 */
import { jsonb, pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const syncRunStatusEnum = pgEnum("sync_run_status", [
  "queued",
  "running",
  "success",
  "error",
]);

export const syncRuns = pgTable("sync_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** Origem do job: "manual" (tRPC) ou "webhook" (ERP). */
  source: varchar("source", { length: 50 }).notNull(),
  status: syncRunStatusEnum("status").notNull().default("queued"),
  /** Estatísticas do processamento (created/updated/skipped) ou detalhe do full-sync pendente. */
  stats: jsonb("stats"),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});
