/**
 * Submissões do formulário de contato público (`POST /api/contact`) — a
 * primeira forma real de captar lead do site (o botão "Solicite um
 * orçamento" antes apontava para uma página inexistente).
 *
 * Decisões relevantes:
 *  - A LINHA É GRAVADA ANTES de qualquer canal de saída (RD Station,
 *    e-mail): o lead nunca se perde por causa de uma API de terceiro fora
 *    do ar — a tabela é a fonte de verdade, os canais são best-effort.
 *  - `productName`/`productSku` são um SNAPSHOT resolvido no SERVIDOR a
 *    partir de `productSlug` (nunca aceito cru do body): o visitante só
 *    manda o slug, e a rota resolve o nome/SKU reais do catálogo antes de
 *    gravar/enviar. Isso evita que texto arbitrário do cliente vá parar no
 *    campo customizado `cf_produto_interesse` do RD Station (o CRM comercial
 *    do time) via um payload forjado.
 *  - `clientTrackingId` é ÚNICO por dois motivos: (1) dedupe de reenvio
 *    acidental do form no nosso lado; (2) é o MESMO valor mandado ao RD
 *    Station como `client_tracking_id` — a Conversions API do RD Station
 *    não é idempotente (reenviar o mesmo evento cria um evento novo), então
 *    este ID serve para correlação/debug, não para o RD deduplicar sozinho.
 *  - `rdStationStatus`/`emailStatus` ("pending" | "sent" | "failed") + os
 *    campos `*Error`/`*EventUuid` guardam o resultado dos dois canais
 *    (disparados em paralelo, nenhum bloqueia o outro) — permite um job de
 *    retry futuro sem re-perguntar nada ao visitante.
 */
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Valor NOVO sempre no FIM da lista: no meio, o drizzle-kit gera o recreate
 * completo do tipo (bem mais arriscado) em vez de um `ALTER TYPE … ADD
 * VALUE`. E a migration que adiciona um valor NUNCA pode usá-lo no mesmo
 * arquivo (backfill/DEFAULT): o migrator do Drizzle roda todas as migrations
 * pendentes numa ÚNICA transação, e o Postgres proíbe usar um valor de enum
 * ainda não commitado — o rollback derrubaria todas as pendentes.
 */
export const contactSubjectEnum = pgEnum("contact_subject", [
  "call_back",
  "quote",
  "general",
  "catalog",
  "cart",
]);

export const contactSubmissions = pgTable(
  "contact_submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    subject: contactSubjectEnum("subject").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    companyName: text("company_name"),
    cnpj: varchar("cnpj", { length: 18 }),
    message: text("message"),
    productSlug: text("product_slug"),
    /** Snapshot resolvido no servidor — ver comentário de topo do arquivo. */
    productName: text("product_name"),
    productSku: text("product_sku"),
    /**
     * ORIGEM: seção do site de onde partiu o clique (`?origem=`, lista
     * fechada em `@/shared/lib/lead-origin`). Valor fora da lista é gravado
     * como NULL — nunca confiamos no que vem da URL.
     */
    origin: text("origin"),
    /** CAMPANHA externa (`utm_*`) — complementar à origem, nunca a substitui. */
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    locale: varchar("locale", { length: 5 }).notNull(),
    clientTrackingId: uuid("client_tracking_id").notNull().unique(),
    consentGranted: boolean("consent_granted").notNull().default(false),
    consentAt: timestamp("consent_at", { withTimezone: true }),
    rdStationStatus: varchar("rd_station_status", { length: 20 }).notNull().default("pending"),
    rdStationEventUuid: text("rd_station_event_uuid"),
    rdStationError: text("rd_station_error"),
    emailStatus: varchar("email_status", { length: 20 }).notNull().default("pending"),
    emailError: text("email_error"),
    ip: varchar("ip", { length: 45 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("contact_submissions_created_at_idx").on(table.createdAt),
  ]
);

export type ContactSubmission = typeof contactSubmissions.$inferSelect;

/**
 * Itens de uma submissão de CARRINHO DE COTAÇÃO (`subject = "cart"`). Uma
 * `contact_submissions` com vários produtos, em vez do par singular
 * `productSlug`/`productName`/`productSku` usado pelos outros quatro
 * assuntos — por isso vive em tabela própria (1:N), não em colunas extras.
 *
 * `productName`/`productSku` são SNAPSHOT resolvido no SERVIDOR a partir de
 * `productSlug` — mesmo critério do par singular em `contactSubmissions`
 * (ver comentário de topo do arquivo): o cliente manda slug + quantidade, o
 * servidor resolve nome/SKU reais do catálogo antes de gravar. `quantity` é
 * a única informação que vem do cliente sem resolução — o servidor nunca
 * inventa quantidade.
 *
 * `onDelete: "cascade"`: apagar a submissão (ex.: expurgo de retenção LGPD
 * futuro) apaga os itens junto — não há sentido em item órfão sem submissão.
 */
export const contactSubmissionItems = pgTable(
  "contact_submission_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => contactSubmissions.id, { onDelete: "cascade" }),
    productSlug: text("product_slug"),
    /** Snapshot resolvido no servidor — nunca aceito cru do body. */
    productName: text("product_name"),
    productSku: text("product_sku"),
    quantity: integer("quantity").notNull().default(1),
    /** Preserva a ordem de montagem do carrinho (não é a ordem de exibição do catálogo). */
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("contact_submission_items_submission_id_idx").on(table.submissionId),
  ]
);

export type ContactSubmissionItem = typeof contactSubmissionItems.$inferSelect;
