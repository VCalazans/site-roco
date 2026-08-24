/**
 * Materiais de apoio compartilhados com representantes (política comercial,
 * logística, contatos, treinamento, vídeos institucionais etc.) —
 * gerenciados pelo admin do portal em `/{locale}/portal/materiais`.
 *
 * Substitui os cards estáticos com CTA "Em breve" que existiam na página
 * de boas-vindas do representante (`welcome.contacts`/`commercialPolicy`/
 * `logistics`/`library`) por um feed real, ordenado em linha do tempo por
 * `publishedAt`. Ver decisionLog 2026-08-24 ("Materiais dinâmicos para
 * representantes").
 *
 * Decisões relevantes:
 *  - `r2Key` é **NOT NULL** por design: o upload é sempre obrigatório —
 *    nunca se aceita colar uma URL externa (pedido explícito do
 *    stakeholder: "tudo que é compartilhado com o representante deve ser
 *    upado"). Diferente de produtos/hero, o objeto é **privado**: a leitura
 *    é sempre via `getPresignedDownloadUrl` gerada na hora da consulta
 *    (nunca `R2_PUBLIC_URL`) — material comercial não deve ficar acessível
 *    publicamente sem login.
 *  - `publishedAt` é setado apenas na PRIMEIRA vez que `published` vira
 *    `true` e NUNCA sobrescrito depois — mesmo que o material seja
 *    despublicado e republicado, ou que a descrição seja editada. É essa
 *    data (estável) que ordena o feed do representante como "linha do
 *    tempo" de materiais.
 *  - `category` é texto livre (não enum de banco): a UI sugere um conjunto
 *    fixo de opções (`commercial_policy`, `logistics`, `contacts`,
 *    `training`, `other`), mas é convenção de aplicação, não constraint —
 *    evita migration toda vez que uma categoria nova surgir.
 */
import { boolean, index, integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const materials = pgTable(
  "materials",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    titlePt: text("title_pt").notNull(),
    titleEn: text("title_en"),
    descriptionPt: text("description_pt"),
    descriptionEn: text("description_en"),

    /** Texto livre — ver opções sugeridas no comentário de topo do arquivo. */
    category: varchar("category", { length: 40 }),

    /** Chave do objeto no R2 (privado). Upload sempre obrigatório. */
    r2Key: text("r2_key").notNull(),
    filename: varchar("filename", { length: 255 }).notNull(),
    contentType: varchar("content_type", { length: 100 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),

    published: boolean("published").notNull().default(false),
    /** Setado só na 1ª vez que `published` vira `true`; nunca sobrescrito depois. */
    publishedAt: timestamp("published_at", { withTimezone: true }),

    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("materials_published_published_at_idx").on(table.published, table.publishedAt),
  ]
);

export type Material = typeof materials.$inferSelect;
