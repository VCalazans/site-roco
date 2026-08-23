import "server-only";
import { and, asc, desc, eq, isNull, lte, or, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { getPublicUrl } from "@/core/storage/r2";
import { db as dbClient } from "@/db";
import {
  heroSlideKindEnum,
  type HeroSlide,
  heroSlides,
} from "@/db/schema/hero-slides";
import type { Locale } from "@/i18n/config";

type Database = typeof dbClient;

/**
 * Shape pública do slide para o site. Omitimos chaves internas (`id`,
 * `createdByUserId`, timestamps) e serializamos os caminhos de mídia via
 * `getPublicUrl` (que respeita `R2_PUBLIC_URL` em runtime). O cliente
 * decide se precisa preencher `headline_pt` ou `headline_en` conforme o
 * `locale` em uso.
 */
export type PublicHeroSlide = {
  id: string;
  slug: string;
  kind: (typeof heroSlideKindEnum)[number];
  /** ID cru do YouTube (`rqn-okkh0ww`) — montado em URL só na renderização. */
  youtubeId: string | null;
  /** URL pública do MP4/poster no R2. `null` se `r2Key`/`r2PosterKey`
   *  ausentes ou se `R2_PUBLIC_URL` não estiver configurada (dev). */
  videoUrl: string | null;
  posterUrl: string | null;
  eyebrow: string | null;
  headline: string;
  headlineEn: string | null;
  description: string | null;
  descriptionEn: string | null;
  primaryCta: { label: string; href: string } | null;
  secondaryCta: { label: string; href: string } | null;
  loopWindow: { startSeconds: number; endSeconds: number } | null;
  muted: boolean;
  /** Carrossel: segundos que o PRÓXIMO slide fica no ar. `null`/0 = sem
   *  rotação (default 8s no client se ausente). */
  autoAdvanceSeconds: number | null;
};

function safePublicUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  try {
    return getPublicUrl(key);
  } catch {
    return null;
  }
}

function pickLocalized<T extends string>(
  pt: T | null | undefined,
  en: T | null | undefined,
  locale: Locale
): T | null {
  if (locale === "en") return (en ?? pt ?? null) as T | null;
  return (pt ?? en ?? null) as T | null;
}

function toPublic(row: HeroSlide, locale: Locale): PublicHeroSlide {
  const headline = pickLocalized(row.headlinePt, row.headlineEn, locale) ?? row.headlinePt;
  const eyebrow = pickLocalized(row.eyebrowPt, row.eyebrowEn, locale);
  const description = pickLocalized(row.descriptionPt, row.descriptionEn, locale);

  const primaryLabel = pickLocalized(row.primaryCtaLabelPt, row.primaryCtaLabelEn, locale);
  const primary = primaryLabel && row.primaryCtaHref
    ? { label: primaryLabel, href: row.primaryCtaHref }
    : null;

  const secondaryLabel = pickLocalized(row.secondaryCtaLabelPt, row.secondaryCtaLabelEn, locale);
  const secondary = secondaryLabel && row.secondaryCtaHref
    ? { label: secondaryLabel, href: row.secondaryCtaHref }
    : null;

  const loop =
    row.loopWindowStartSeconds != null && row.loopWindowEndSeconds != null
      ? {
          startSeconds: row.loopWindowStartSeconds,
          endSeconds: row.loopWindowEndSeconds,
        }
      : null;

  return {
    id: row.id,
    slug: row.slug,
    kind: row.kind,
    youtubeId: row.youtubeId ?? null,
    videoUrl: row.kind === "upload" ? safePublicUrl(row.r2Key) : null,
    posterUrl: safePublicUrl(row.r2PosterKey),
    eyebrow,
    headline,
    headlineEn: row.headlineEn ?? null,
    description,
    descriptionEn: row.descriptionEn ?? null,
    primaryCta: primary,
    secondaryCta: secondary,
    loopWindow: loop,
    muted: row.muted,
    autoAdvanceSeconds: row.autoAdvanceSeconds ?? null,
  };
}

/**
 * Lista os slides ATIVOS para o site público. Filtra por:
 *  - `published = true`;
 *  - janela de visibilidade (`starts_at`/`ends_at`) — se ambos NULL,
 *    sempre visível;
 *  - ordenação por `sort_order` asc.
 *
 * Cache de 300s com tag `"hero"`. Toda mutação do admin
 * (`hero-slides.update`/`delete`/`reorder`) chama
 * `revalidateTag("hero", "max")` — mesmo padrão do `products`.
 */
export async function getActiveHeroSlides(
  locale: Locale,
  db: Database = dbClient
): Promise<PublicHeroSlide[]> {
  const now = new Date();
  const rows = await db
    .select()
    .from(heroSlides)
    .where(
      and(
        eq(heroSlides.published, true),
        or(isNull(heroSlides.startsAt), lte(heroSlides.startsAt, now)),
        or(isNull(heroSlides.endsAt), sql`${heroSlides.endsAt} > ${now}`)
      )
    )
    .orderBy(asc(heroSlides.sortOrder), asc(heroSlides.createdAt));

  return rows.map((row) => toPublic(row, locale));
}

/** Versão cacheada da getter pública (chaveada por locale). */
export const getCachedActiveHeroSlides = (locale: Locale) =>
  unstable_cache(
    async () => getActiveHeroSlides(locale),
    ["hero", "active", locale],
    { revalidate: 300, tags: ["hero"] }
  )();

/**
 * Lista ADMINISTRATIVA — retorna TODOS os slides (publicados ou não), com
 * timestamps e flags de janela. Sem cache (a tela do admin precisa sempre
 * do estado atual).
 */
export async function listHeroSlidesForAdmin(db: Database = dbClient): Promise<HeroSlide[]> {
  return db
    .select()
    .from(heroSlides)
    .orderBy(asc(heroSlides.sortOrder), desc(heroSlides.createdAt));
}
