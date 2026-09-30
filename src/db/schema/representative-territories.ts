import { index, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { representatives } from "./representatives";

/** Nível da área: estado inteiro, região (mesorregião do IBGE) ou cidade. */
export const territoryKindEnum = pgEnum("territory_kind", ["state", "region", "city"]);

/**
 * Área de atuação do representante: uma linha por estado, região ou cidade
 * escolhida na base de localidades do IBGE (`src/shared/data/ibge-localidades.json`).
 * Guarda só o código IBGE — o nome vem da base, que o servidor usa para validar
 * o que chega. `representatives.region` continua com o resumo legível, para as
 * listas e telas antigas e para os cadastros de antes (texto livre).
 */
export const representativeTerritories = pgTable(
  "representative_territories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    representativeId: uuid("representative_id")
      .notNull()
      .references(() => representatives.id, { onDelete: "cascade" }),
    kind: territoryKindEnum("kind").notNull(),
    /** Sigla da UF ("SC"), id da mesorregião ("4204") ou do município ("4202404"). */
    code: varchar("code", { length: 8 }).notNull(),
    /** UF da área — é por ela que o admin filtra os representantes por estado. */
    uf: varchar("uf", { length: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("representative_territories_entry_unique").on(table.representativeId, table.kind, table.code),
    index("representative_territories_uf_idx").on(table.uf),
  ]
);
