/**
 * Onboarding e cadastro de representantes comerciais da ROCO.
 */
import { integer, pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const representativeStatusEnum = pgEnum("representative_status", [
  "draft",
  "submitted",
  "approved",
  "rejected",
]);

export const representatives = pgTable("representatives", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  status: representativeStatusEnum("status").notNull().default("draft"),
  onboardingStep: integer("onboarding_step").notNull().default(0),
  companyName: text("company_name"),
  cnpj: varchar("cnpj", { length: 18 }),
  phone: text("phone"),
  /** Região/território de atuação comercial do representante. */
  region: text("region"),
  /** Notas do próprio representante (preenchidas no onboarding). */
  notes: text("notes"),
  /** Timestamp de quando o cadastro foi enviado para análise (`submitOnboarding`). */
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  reviewedBy: text("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  /** Retorno do revisor ao representante (distinto de `notes`, que é do próprio representante). */
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const representativeDocuments = pgTable("representative_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  representativeId: uuid("representative_id")
    .notNull()
    .references(() => representatives.id, { onDelete: "cascade" }),
  r2Key: text("r2_key").notNull(),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
