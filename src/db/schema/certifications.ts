/**
 * Selos de certificação da ROCO (ex.: Great Place To Work) — cadastrados no
 * portal (Configurações do Site › Certificações) e exibidos no rodapé, na
 * página Sobre e nos dados estruturados da empresa.
 *
 * Vigência controlada aqui: passado `valid_until`, o selo some do site sozinho
 * (exibir certificação vencida é propaganda enganosa — CDC). A imagem é um
 * upload do portal (`image_key`, R2/MinIO em `site/certificacoes/`) ou, no selo
 * que já existia antes do cadastro, um arquivo de `public/` (`image_path`).
 */
import { boolean, date, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const certifications = pgTable("certifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  namePt: text("name_pt").notNull(),
  nameEn: text("name_en"),
  /** Linha curta sob o nome (ex.: "Certificada · fev 2026 – fev 2027"). */
  notePt: text("note_pt"),
  noteEn: text("note_en"),
  /** Texto alternativo da imagem (acessibilidade). */
  altPt: text("alt_pt"),
  altEn: text("alt_en"),
  imageKey: text("image_key"),
  imagePath: text("image_path"),
  /** Página oficial da certificação (opcional, só https). */
  linkUrl: text("link_url"),
  /** Último dia em que o selo aparece no site (inclusive). Vazio = sem vencimento. */
  validUntil: date("valid_until", { mode: "string" }),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedByUserId: text("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
