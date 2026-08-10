/**
 * Modelo de catálogo derivado da planilha real (769 produtos; o ERP tem
 * 1.254 códigos, incluindo variantes de embalagem). Campos textuais como
 * `sku`/`ncm` são `varchar` (não numéricos) porque a fonte tem zeros à
 * esquerda que uma coluna numérica descartaria.
 */
import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const packagingTypeEnum = pgEnum("packaging_type", [
  "peca",
  "blister",
  "caixa",
  "saco_plastico",
]);

export const productBadgeEnum = pgEnum("product_badge", [
  "nacional",
  "universal",
  "top",
  "tres_em_um",
  "seguro",
]);

export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 160 }).notNull().unique(),
  namePt: text("name_pt").notNull(),
  nameEn: text("name_en"),
  /** Auto-referência para hierarquia (categoria > subcategoria). */
  parentId: uuid("parent_id").references((): AnyPgColumn => categories.id, {
    onDelete: "set null",
  }),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** COD do catálogo — texto para preservar zeros à esquerda. */
  sku: varchar("sku", { length: 20 }).notNull().unique(),
  /** Código ERP (5-7 dígitos, zero-padded); nulo até o primeiro sync. */
  erpCode: varchar("erp_code", { length: 20 }),
  slug: varchar("slug", { length: 220 }).notNull().unique(),
  namePt: text("name_pt").notNull(),
  nameEn: text("name_en"),
  descriptionPt: text("description_pt"),
  descriptionEn: text("description_en"),
  /** NCM — texto: o Excel de origem comeu os zeros à esquerda em algumas linhas. */
  ncm: varchar("ncm", { length: 8 }),
  barcodeEan13: varchar("barcode_ean13", { length: 13 }),
  priceCents: integer("price_cents"),
  published: boolean("published").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const productCategories = pgTable(
  "product_categories",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    /** Um produto pode estar em >1 categoria (ex.: produto 1083 real); só uma é a primária. */
    isPrimary: boolean("is_primary").notNull().default(false),
  },
  (table) => [primaryKey({ columns: [table.productId, table.categoryId] })]
);

export const productPackagings = pgTable(
  "product_packagings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    packagingType: packagingTypeEnum("packaging_type").notNull(),
    unitsPerPack: integer("units_per_pack").notNull(),
    /** Sufixo do código ERP que identifica a variante (ex.: "412" = blister×12). */
    erpComplementCode: varchar("erp_complement_code", { length: 4 }),
    /** Algumas variantes têm EAN próprio, distinto do produto base (ex.: produto 2108). */
    barcodeEan13: varchar("barcode_ean13", { length: 13 }),
    isDefault: boolean("is_default").notNull().default(false),
  },
  (table) => [
    unique("product_packagings_product_type_units_unique").on(
      table.productId,
      table.packagingType,
      table.unitsPerPack
    ),
  ]
);

export const productImages = pgTable("product_images", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  r2Key: text("r2_key").notNull(),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  altPt: text("alt_pt"),
  altEn: text("alt_en"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const productBadges = pgTable(
  "product_badges",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    badge: productBadgeEnum("badge").notNull(),
  },
  (table) => [primaryKey({ columns: [table.productId, table.badge] })]
);
