/**
 * Conteúdo EDITÁVEL da página inicial (spec 001, RF17–RF21).
 *
 * Modelo: um documento jsonb por seção em `site_settings` (chaves em
 * `HOME_CONTENT_KEYS`), salvo individualmente pelo editor do portal — dois
 * operadores editando seções diferentes nunca se sobrescrevem. O hero NÃO
 * está aqui: continua na tabela `hero_slides` (editor próprio).
 *
 * Regra de resolução (única, testada): para cada campo de texto, o valor
 * salvo no idioma da página; vazio → o texto PADRÃO do dicionário daquele
 * idioma. Assim o dicionário continua sendo a fonte da copy padrão (regra nº 1
 * do projeto) e o banco só guarda o que o operador sobrescreveu.
 *
 * Módulo PURO (sem `server-only`, sem I/O): os schemas validam a escrita no
 * router tRPC e a leitura no loader do servidor (`safeParse` tolerante — um
 * documento inválido nunca derruba a home, cai no padrão), e o editor do
 * portal reaproveita os mesmos tipos.
 */
import { z } from "zod";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { isSafeHref, MAX_HREF_LENGTH } from "@/shared/lib/safe-href";

/** Seções reordenáveis/ocultáveis da home (o hero é fixo no topo). */
export const HOME_SECTION_IDS = ["facade", "about", "categories", "featured", "portalCta"] as const;
export type HomeSectionId = (typeof HOME_SECTION_IDS)[number];

/** Ordem padrão — a fachada logo após o hero, como pedido no briefing. */
export const DEFAULT_HOME_SECTION_ORDER: readonly HomeSectionId[] = HOME_SECTION_IDS;

/**
 * Âncora de página de cada seção que tem uma (`<section id>` nos componentes
 * `home-facade`/`home-about`). Serve para não publicar link morto: o CTA
 * padrão da fachada é `#sobre`, e ocultar a seção institucional no painel
 * deixaria o botão apontando para nada.
 */
export const HOME_SECTION_ANCHORS: Partial<Record<HomeSectionId, string>> = {
  facade: "fachada",
  about: "sobre",
};

/** `true` se o href é a âncora (`#id`) de uma seção que NÃO está visível. */
export function targetsHiddenSection(href: string, visibleSections: readonly HomeSectionId[]): boolean {
  if (!href.startsWith("#")) return false;
  const anchor = href.slice(1);
  return (Object.entries(HOME_SECTION_ANCHORS) as [HomeSectionId, string][]).some(
    ([id, value]) => value === anchor && !visibleSections.includes(id)
  );
}

/** Documentos editáveis (layout + uma entrada por seção) → chave em `site_settings`. */
export const HOME_CONTENT_KEYS = {
  layout: "home.layout",
  facade: "home.facade",
  about: "home.about",
  categories: "home.categories",
  featured: "home.featured",
  portalCta: "home.portal-cta",
} as const;

export type HomeContentDocument = keyof typeof HOME_CONTENT_KEYS;
export const HOME_CONTENT_DOCUMENTS = Object.keys(HOME_CONTENT_KEYS) as HomeContentDocument[];

/** Prefixo obrigatório das imagens enviadas pelo editor da home (bucket R2). */
export const HOME_IMAGE_KEY_PREFIX = "site/home/";

/** Chave gerada pelo `presignImage`: `site/home/<uuid>.<ext>` — nada mais passa. */
const IMAGE_KEY_PATTERN = /^site\/home\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;
/** Imagem estática padrão servida de `public/` (ex.: arte das categorias). */
const STATIC_IMAGE_PATTERN = /^\/images\/[a-z0-9/_.-]+\.(jpg|jpeg|png|webp)$/i;

/** Imagem padrão da seção de fachada (recorte do render oficial — trocável no painel). */
export const DEFAULT_FACADE_IMAGE = "/images/home/fachada-roco.jpg";

export const HOME_FEATURED_LIMIT = { min: 4, max: 12, default: 8 } as const;
export const HOME_MAX_HIGHLIGHTS = 8;
export const HOME_MAX_CATEGORY_ITEMS = 12;

// ---------------------------------------------------------------------------
// Schemas (escrita estrita no router; leitura tolerante no loader)
// ---------------------------------------------------------------------------

const text = (max: number) => z.string().trim().max(max);

/**
 * Texto nos dois idiomas; vazio = "usar o padrão do dicionário".
 *
 * O objeto AUSENTE também vale vazio (default por função — nunca um objeto
 * compartilhado entre parses): um campo acrescentado ao schema no futuro não
 * pode invalidar os documentos já salvos, senão a leitura tolerante os
 * descartaria inteiros e TODA a edição do operador sumiria do site em silêncio.
 */
export const localizedText = (max: number) =>
  z.object({ pt: text(max).default(""), en: text(max).default("") }).default(() => ({ pt: "", en: "" }));

export type LocalizedText = { pt: string; en: string };

/** Destino de CTA/card: vazio = padrão; senão só links seguros (`isSafeHref`). */
export const homeHrefSchema = text(MAX_HREF_LENGTH).refine((value) => value === "" || isSafeHref(value), {
  message: "invalid_href",
});

export const homeImageKeySchema = z.string().regex(IMAGE_KEY_PATTERN).nullable();
const staticImagePathSchema = z.string().regex(STATIC_IMAGE_PATTERN).nullable();

const ctaFields = {
  ctaLabel: localizedText(60),
  /** Ausente = vazio = destino padrão do dicionário (mesma razão de `localizedText`). */
  ctaHref: homeHrefSchema.default(""),
};

export const homeLayoutSchema = z.object({
  sections: z
    .array(z.object({ id: z.enum(HOME_SECTION_IDS), enabled: z.boolean() }))
    .max(HOME_SECTION_IDS.length)
    .refine((sections) => new Set(sections.map((section) => section.id)).size === sections.length, {
      message: "duplicate_section",
    }),
});

export const homeFacadeSchema = z.object({
  imageKey: homeImageKeySchema.default(null),
  imageAlt: localizedText(200),
  eyebrow: localizedText(80),
  headline: localizedText(120),
  text: localizedText(400),
  showCta: z.boolean().default(true),
  ...ctaFields,
});

export const homeHighlightSchema = z.object({
  label: localizedText(60),
  value: localizedText(160),
});

export const homeAboutSchema = z.object({
  eyebrow: localizedText(80),
  headline: localizedText(120),
  /** Parágrafos separados por linha em branco. */
  paragraphs: localizedText(2400),
  /** `null` = usar os destaques padrão do dicionário. */
  highlights: z.array(homeHighlightSchema).max(HOME_MAX_HIGHLIGHTS).nullable().default(null),
  showCatalogStats: z.boolean().default(true),
  ...ctaFields,
});

export const homeCategoryItemSchema = z.object({
  label: localizedText(60),
  href: homeHrefSchema,
  /** Imagem enviada pelo painel (R2) — tem prioridade sobre `imagePath`. */
  imageKey: homeImageKeySchema.default(null),
  /** Arte padrão de `public/` (preenchida quando o item nasce do dicionário). */
  imagePath: staticImagePathSchema.default(null),
  alt: localizedText(200),
});

export const homeCategoriesSchema = z.object({
  eyebrow: localizedText(80),
  headline: localizedText(120),
  description: localizedText(400),
  ...ctaFields,
  /** `null` = usar os 6 cards padrão do dicionário. */
  items: z.array(homeCategoryItemSchema).min(1).max(HOME_MAX_CATEGORY_ITEMS).nullable().default(null),
});

export const homeFeaturedSchema = z.object({
  eyebrow: localizedText(80),
  headline: localizedText(120),
  description: localizedText(400),
  emptyState: localizedText(200),
  ...ctaFields,
  limit: z
    .number()
    .int()
    .min(HOME_FEATURED_LIMIT.min)
    .max(HOME_FEATURED_LIMIT.max)
    .default(HOME_FEATURED_LIMIT.default),
});

export const homePortalCtaSchema = z.object({
  headline: localizedText(120),
  description: localizedText(400),
  ...ctaFields,
});

export const HOME_CONTENT_SCHEMAS = {
  layout: homeLayoutSchema,
  facade: homeFacadeSchema,
  about: homeAboutSchema,
  categories: homeCategoriesSchema,
  featured: homeFeaturedSchema,
  portalCta: homePortalCtaSchema,
} as const;

export type HomeLayoutDocument = z.infer<typeof homeLayoutSchema>;
export type HomeFacadeDocument = z.infer<typeof homeFacadeSchema>;
export type HomeAboutDocument = z.infer<typeof homeAboutSchema>;
export type HomeCategoriesDocument = z.infer<typeof homeCategoriesSchema>;
export type HomeCategoryItemDocument = z.infer<typeof homeCategoryItemSchema>;
export type HomeFeaturedDocument = z.infer<typeof homeFeaturedSchema>;
export type HomePortalCtaDocument = z.infer<typeof homePortalCtaSchema>;

export type HomeContentDocuments = {
  layout: HomeLayoutDocument | null;
  facade: HomeFacadeDocument | null;
  about: HomeAboutDocument | null;
  categories: HomeCategoriesDocument | null;
  featured: HomeFeaturedDocument | null;
  portalCta: HomePortalCtaDocument | null;
};

export const EMPTY_HOME_DOCUMENTS: HomeContentDocuments = {
  layout: null,
  facade: null,
  about: null,
  categories: null,
  featured: null,
  portalCta: null,
};

/** Documento → chave; e o inverso, para mapear linhas do banco. */
export function homeDocumentForKey(key: string): HomeContentDocument | null {
  const entry = Object.entries(HOME_CONTENT_KEYS).find(([, value]) => value === key);
  return entry ? (entry[0] as HomeContentDocument) : null;
}

/**
 * Lê um valor cru do banco com tolerância total: jsonb pode chegar como
 * objeto ou como string JSON (ver comentário de `readSetting` em
 * `@/server/lib/site-settings`); qualquer coisa inválida vira `null` (= usar o
 * padrão) em vez de lançar — conteúdo editado nunca derruba a home.
 */
export function parseHomeDocument<D extends HomeContentDocument>(
  document: D,
  raw: unknown
): HomeContentDocuments[D] {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (value === null || typeof value !== "object") return null;
  const result = HOME_CONTENT_SCHEMAS[document].safeParse(value);
  return result.success ? (result.data as HomeContentDocuments[D]) : null;
}

/** Converte linhas `{ key, value }` de `site_settings` nos documentos da home. */
export function parseHomeRows(rows: readonly { key: string; value: unknown }[]): HomeContentDocuments {
  const documents: HomeContentDocuments = { ...EMPTY_HOME_DOCUMENTS };
  for (const row of rows) {
    const document = homeDocumentForKey(row.key);
    if (!document) continue;
    (documents as Record<HomeContentDocument, unknown>)[document] = parseHomeDocument(document, row.value);
  }
  return documents;
}

/** Todas as chaves de imagem R2 referenciadas pelos documentos (para URLs/limpeza). */
export function collectHomeImageKeys(documents: Partial<HomeContentDocuments>): string[] {
  const keys = new Set<string>();
  if (documents.facade?.imageKey) keys.add(documents.facade.imageKey);
  for (const item of documents.categories?.items ?? []) {
    if (item.imageKey) keys.add(item.imageKey);
  }
  return [...keys];
}

// ---------------------------------------------------------------------------
// Resolução (documentos + dicionário → props prontas para os componentes)
// ---------------------------------------------------------------------------

export type HomeDictionary = Dictionary["home"];

export type ResolvedCta = { label: string; href: string };

export type ResolvedHomeContent = {
  /** Seções VISÍVEIS, na ordem de exibição (após o hero). */
  sections: HomeSectionId[];
  facade: {
    imageUrl: string;
    imageAlt: string;
    eyebrow: string;
    headline: string;
    text: string;
    cta: ResolvedCta | null;
  };
  about: {
    eyebrow: string;
    headline: string;
    paragraphs: string[];
    highlights: { label: string; value: string }[];
    showCatalogStats: boolean;
    catalogHighlight: { label: string; value: string };
    cta: ResolvedCta;
  };
  categories: {
    eyebrow: string;
    headline: string;
    description: string;
    cta: ResolvedCta;
    items: { label: string; href: string; imageUrl: string; alt: string }[];
  };
  featured: {
    eyebrow: string;
    headline: string;
    description: string;
    emptyState: string;
    cta: ResolvedCta;
    limit: number;
  };
  portalCta: {
    headline: string;
    description: string;
    cta: ResolvedCta;
  };
};

/** Layout salvo → lista completa (toda seção exatamente uma vez, desconhecidas descartadas). */
export function resolveHomeLayout(
  layout: HomeLayoutDocument | null
): { id: HomeSectionId; enabled: boolean }[] {
  const seen = new Set<HomeSectionId>();
  const result: { id: HomeSectionId; enabled: boolean }[] = [];
  for (const section of layout?.sections ?? []) {
    if (seen.has(section.id) || !HOME_SECTION_IDS.includes(section.id)) continue;
    seen.add(section.id);
    result.push({ id: section.id, enabled: section.enabled });
  }
  for (const id of DEFAULT_HOME_SECTION_ORDER) {
    if (!seen.has(id)) result.push({ id, enabled: true });
  }
  return result;
}

/** Campo de topo: idioma da página → padrão do dicionário do mesmo idioma. */
export function pickLocalized(value: LocalizedText | null | undefined, locale: Locale, fallback: string): string {
  const own = value?.[locale]?.trim();
  return own ? own : fallback;
}

/**
 * Item de LISTA criado pelo operador (destaque, card): idioma da página →
 * o outro idioma → vazio. Não há padrão de dicionário "na mesma posição" que
 * faça sentido para um item novo, e mostrar o texto do outro idioma é melhor
 * que um card sem rótulo.
 */
export function pickItemText(value: LocalizedText | null | undefined, locale: Locale): string {
  const own = value?.[locale]?.trim();
  if (own) return own;
  const other = value?.[locale === "pt" ? "en" : "pt"]?.trim();
  return other ?? "";
}

/** Parágrafos separados por linha em branco (o editor usa um `<textarea>`). */
export function splitParagraphs(value: string): string[] {
  return value
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}

function pickCta(
  document: { ctaLabel: LocalizedText; ctaHref: string } | null | undefined,
  locale: Locale,
  fallback: { label: string; href: string }
): ResolvedCta {
  return {
    label: pickLocalized(document?.ctaLabel, locale, fallback.label),
    href: document?.ctaHref?.trim() || fallback.href,
  };
}

export type ResolveHomeContentInput = {
  documents: HomeContentDocuments;
  locale: Locale;
  defaults: HomeDictionary;
  /** Chave R2 → URL pública (`null` se o storage não estiver configurado). */
  imageUrl: (key: string) => string | null;
};

export function resolveHomeContent({
  documents,
  locale,
  defaults,
  imageUrl,
}: ResolveHomeContentInput): ResolvedHomeContent {
  const { facade, about, categories, featured, portalCta } = documents;

  const sections = resolveHomeLayout(documents.layout)
    .filter((section) => section.enabled)
    .map((section) => section.id);

  const facadeCta = facade?.showCta === false ? null : pickCta(facade, locale, defaults.facade.cta);

  const storedParagraphs = splitParagraphs(about?.paragraphs?.[locale] ?? "");

  const storedHighlights = about?.highlights
    ?.map((item) => ({ label: pickItemText(item.label, locale), value: pickItemText(item.value, locale) }))
    .filter((item) => item.label);

  const storedItems = categories?.items
    ?.map((item) => ({
      label: pickItemText(item.label, locale),
      href: item.href,
      imageUrl: (item.imageKey ? imageUrl(item.imageKey) : null) ?? item.imagePath ?? "",
      alt: pickItemText(item.alt, locale),
    }))
    .filter((item) => item.label && item.href && item.imageUrl);

  return {
    sections,
    facade: {
      imageUrl: (facade?.imageKey ? imageUrl(facade.imageKey) : null) ?? DEFAULT_FACADE_IMAGE,
      imageAlt: pickLocalized(facade?.imageAlt, locale, defaults.facade.imageAlt),
      eyebrow: pickLocalized(facade?.eyebrow, locale, defaults.facade.eyebrow),
      headline: pickLocalized(facade?.headline, locale, defaults.facade.headline),
      text: pickLocalized(facade?.text, locale, defaults.facade.text),
      // Botão que levaria a uma seção oculta sai em vez de virar link morto.
      cta: facadeCta && !targetsHiddenSection(facadeCta.href, sections) ? facadeCta : null,
    },
    about: {
      eyebrow: pickLocalized(about?.eyebrow, locale, defaults.about.eyebrow),
      headline: pickLocalized(about?.headline, locale, defaults.about.headline),
      paragraphs: storedParagraphs.length > 0 ? storedParagraphs : defaults.about.paragraphs,
      highlights: storedHighlights && storedHighlights.length > 0 ? storedHighlights : defaults.about.highlights,
      showCatalogStats: about?.showCatalogStats ?? true,
      catalogHighlight: defaults.about.catalogHighlight,
      cta: pickCta(about, locale, defaults.about.cta),
    },
    categories: {
      eyebrow: pickLocalized(categories?.eyebrow, locale, defaults.categories.eyebrow),
      headline: pickLocalized(categories?.headline, locale, defaults.categories.headline),
      description: pickLocalized(categories?.description, locale, defaults.categories.description),
      cta: pickCta(categories, locale, defaults.categories.cta),
      items:
        storedItems && storedItems.length > 0
          ? storedItems
          : defaults.categories.items.map((item) => ({
              label: item.label,
              href: item.href,
              imageUrl: item.image,
              alt: item.alt,
            })),
    },
    featured: {
      eyebrow: pickLocalized(featured?.eyebrow, locale, defaults.featured.eyebrow),
      headline: pickLocalized(featured?.headline, locale, defaults.featured.headline),
      description: pickLocalized(featured?.description, locale, defaults.featured.description),
      emptyState: pickLocalized(featured?.emptyState, locale, defaults.featured.emptyState),
      cta: pickCta(featured, locale, defaults.featured.cta),
      limit: featured?.limit ?? HOME_FEATURED_LIMIT.default,
    },
    portalCta: {
      headline: pickLocalized(portalCta?.headline, locale, defaults.portalCta.headline),
      description: pickLocalized(portalCta?.description, locale, defaults.portalCta.description),
      cta: pickCta(portalCta, locale, defaults.portalCta.cta),
    },
  };
}
