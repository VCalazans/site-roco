/**
 * Uso dos recursos de IA, agregado por DIA (painel "Uso da IA" no portal).
 *
 * Só contadores: nenhum IP, nenhum identificador de pessoa ou de conversa.
 * `metric` e `key` vêm de listas fechadas (`@/modules/ai/lib/ai-usage`) — nada
 * digitado por terceiros vira linha aqui.
 * - `connection`: mensagens `initialize` do `/mcp`, por IA (`claude`, `chatgpt`…).
 * - `tool`: chamadas de ferramenta do `/mcp`, por nome da ferramenta.
 * - `connect_click`: cliques em "Conectar ao Claude", por página (`home`, `ia`).
 * - `quote_link`: links de orçamento montados pela IA abertos no site.
 */
import { date, integer, pgTable, primaryKey, text } from "drizzle-orm/pg-core";

export const aiUsageDaily = pgTable(
  "ai_usage_daily",
  {
    /** Dia no fuso de Brasília. */
    day: date("day", { mode: "string" }).notNull(),
    metric: text("metric").notNull(),
    key: text("key").notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.day, table.metric, table.key] })]
);
