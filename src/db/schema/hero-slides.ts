/**
 * Hero slides da home pública — gerenciadas pelo admin do portal
 * (`/{locale}/portal/hero`).
 *
 * Substitui o hero hard-coded do `home-hero.tsx` (que era uma constante
 * `VIDEO_ID` + `LOGO` direto no componente) por uma coleção ordenada de
 * slides, cada um com sua própria mídia (vídeo do YouTube OU upload para o
 * R2), janela de loop configurável e copy i18n (PT/EN). O componente do
 * site lê esses registros via `getActiveHeroSlides()` com cache tag
 * `"hero"` (revalidada a cada mutação do admin — mesmo padrão do catálogo
 * de produtos).
 *
 * Decisões registradas no decisionLog 2026-08-23:
 *  - Slider único por enquanto (1ª seção do site); se o stakeholder quiser
 *    múltiplas seções configuráveis (vitrine, certificações, institucional)
 *    no futuro, o padrão se estende reusando a mesma tabela com um
 *    discriminador `section` (vide ADR).
 *  - Áudio: `muted` é `notNull().default(true)` porque o autoplay do
 *    navegador exige silêncio (regra do Chromium/Safari/Firefox para
 *    `autoplay` sem interação; em produção política pode afrouxar, mas
 *    não mudamos o default).
 *  - Loop: `loop_window_start_seconds` e `loop_window_end_seconds` (ambos
 *    nullable em segundos). Quando NULL ou 0, o `<video>` toca o vídeo
 *    inteiro em loop. Quando setados, o player clamp entre os dois
 *    timestamps a cada ciclo (sem hacks de `setTimeout` — só funciona em
 *    `MediaSource` no Chrome; em outros players o fallback é loop
 *    completo). Vide ADR para o rationale.
 *  - Janela de visibilidade: `starts_at`/`ends_at` permitem agendar um
 *    slide (ex.: "campanha de Natal de 15/12 a 25/12"); o getter
 *    filtra no servidor.
 */
import { boolean, index, integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const heroSlideKindEnum = ["youtube", "upload"] as const;
export type HeroSlideKind = (typeof heroSlideKindEnum)[number];

export const heroSlides = pgTable(
  "hero_slides",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    /** Slug estável — usado como chave de cache + debugging. Gerado a partir
     *  do headline_pt se omitido (helper `slugify`). */
    slug: varchar("slug", { length: 80 }).notNull().unique(),

    kind: varchar("kind", { length: 20 }).$type<HeroSlideKind>().notNull(),

    /** Quando `kind === "youtube"`: ID do vídeo (ex.: `rqn-okkh0ww`). */
    youtubeId: varchar("youtube_id", { length: 32 }),
    /** Quando `kind === "upload"`: chave do objeto no R2 (ex.:
     *  `hero/slides/{uuid}.mp4`). Não URL completa — a `getPublicUrl` é
     *  resolvida em runtime para permitir trocar o `R2_PUBLIC_URL`. */
    r2Key: text("r2_key"),
    /** Pôster estático opcional (sempre uploaded; usado como fallback e
     *  `preload="metadata"` do `<video>`, ou como background se o slide
     *  for YouTube e o `autoplay` for bloqueado). */
    r2PosterKey: text("r2_poster_key"),

    // Copy bilíngue
    eyebrowPt: text("eyebrow_pt"),
    eyebrowEn: text("eyebrow_en"),
    headlinePt: text("headline_pt").notNull(),
    headlineEn: text("headline_en"),
    descriptionPt: text("description_pt"),
    descriptionEn: text("description_en"),

    // CTAs (opcional cada)
    primaryCtaLabelPt: text("primary_cta_label_pt"),
    primaryCtaLabelEn: text("primary_cta_label_en"),
    primaryCtaHref: text("primary_cta_href"),
    secondaryCtaLabelPt: text("secondary_cta_label_pt"),
    secondaryCtaLabelEn: text("secondary_cta_label_en"),
    secondaryCtaHref: text("secondary_cta_href"),

    // Mídia: loop window + áudio + auto-advance do carrossel
    /** Janela de loop (segundos). NULL/0 = vídeo inteiro. */
    loopWindowStartSeconds: integer("loop_window_start_seconds"),
    loopWindowEndSeconds: integer("loop_window_end_seconds"),
    /** NULL = sem rotação automática (slide fica até o usuário navegar /
     *  o próximo ser escolhido pelo admin). Setado (default 8s) ativa o
     *  carrossel com crossfade entre slides. */
    autoAdvanceSeconds: integer("auto_advance_seconds"),
    muted: boolean("muted").notNull().default(true),

    // Ordenação + visibilidade
    sortOrder: integer("sort_order").notNull().default(0),
    published: boolean("published").notNull().default(false),

    // Agendamento
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),

    // Auditoria mínima
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("hero_slides_published_sort_idx").on(table.published, table.sortOrder),
  ]
);

/** Tipo derivado para o site (campos públicos — sem IDs internos). */
export type HeroSlide = typeof heroSlides.$inferSelect;
