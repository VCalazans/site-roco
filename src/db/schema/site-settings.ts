/**
 * Configurações globais editáveis pelo admin do portal. Chave-valor simples
 * (kebab-case) — projetada para configurações que são 1 por site, não
 * coleções. Cada chave é uma string (`type` discrimina o parser: "string",
 * "number", "boolean", "json"). O admin só consegue alterar chaves com
 * `isPublic = true` (visíveis no site público) sem deploy; flags internas
 * continuam por env.
 *
 * Exemplos atuais:
 *   - "catalog.pdf-url"   (string) → URL do PDF de catálogo que o site
 *     serve na landing `/catalogo`. Substitui `NEXT_PUBLIC_CATALOG_PDF_URL`
 *     quando setada.
 *
 * Itens FUTUROS plausíveis: "site.contact-email", "footer.address",
 * "home.cta-product-url", etc. — adicionar aqui quando virar requisito,
 * não antes.
 */
import { boolean, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const siteSettings = pgTable(
  "site_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    /** "string" | "number" | "boolean" | "json" — parser a aplicar no
     *  getter; `value` é sempre jsonb no banco. Default: "string". */
    type: text("type").notNull().default("string"),
    description: text("description"),
    /** Quando `false`, a chave só é legível server-side (ex.: feature
     *  flags internas); o admin não expõe nem edita. Default: `true`. */
    isPublic: boolean("is_public").notNull().default(true),
    updatedByUserId: text("updated_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("site_settings_key_unique").on(table.key)]
);

/** Chave canônica do link do PDF de catálogo (referenciada pelo site e pelo admin). */
export const SITE_SETTING_CATALOG_PDF_URL = "catalog.pdf-url";

/** Chave canônica do telefone/WhatsApp da matriz. */
export const SITE_SETTING_CONTACT_PHONE = "contact.phone";

/** Chave canônica do e-mail público de contato. */
export const SITE_SETTING_CONTACT_EMAIL = "contact.email";

/** Chave canônica do endereço da matriz (Blumenau). */
export const SITE_SETTING_CONTACT_ADDRESS_MATRIZ = "contact.address.matriz";

/** Chave canônica da descrição da filial (Gaspar). */
export const SITE_SETTING_CONTACT_ADDRESS_FILIAL = "contact.address.filial";

/** Chave canônica dos links de redes sociais (JSON: { instagram?, linkedin?, youtube?, whatsapp? }). */
export const SITE_SETTING_SOCIAL_LINKS = "social.links";

export const ALL_PUBLIC_SETTING_KEYS = [
  SITE_SETTING_CATALOG_PDF_URL,
  SITE_SETTING_CONTACT_PHONE,
  SITE_SETTING_CONTACT_EMAIL,
  SITE_SETTING_CONTACT_ADDRESS_MATRIZ,
  SITE_SETTING_CONTACT_ADDRESS_FILIAL,
  SITE_SETTING_SOCIAL_LINKS,
] as const;

export type SiteSetting = typeof siteSettings.$inferSelect;
