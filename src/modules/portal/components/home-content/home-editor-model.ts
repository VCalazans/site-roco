/**
 * Modelo PURO do editor da página inicial (`/portal/pagina-inicial`, spec 001,
 * RF18–RF21): tipos de formulário, valores iniciais, cópia dos padrões do
 * dicionário, validação e utilitários de lista. Sem React e sem I/O — tudo
 * aqui é testável no Vitest (`home-editor-model.test.ts`).
 *
 * Decisão central: o estado do formulário de cada seção É o próprio documento
 * salvo (`HomeFacadeDocument`, `HomeAboutDocument`…). Assim o payload de
 * `homeContent.update` é o formulário validado pelo MESMO schema zod que o
 * servidor usa (`HOME_CONTENT_SCHEMAS`), sem uma segunda definição do formato
 * para manter em dia. Campo de texto vazio significa "usar o texto padrão do
 * dicionário daquele idioma" (RF19) — por isso o editor mostra o padrão como
 * placeholder.
 */
import type { z } from "zod";
import type { Locale } from "@/i18n/config";
import {
  HOME_CONTENT_SCHEMAS,
  HOME_FEATURED_LIMIT,
  HOME_MAX_CATEGORY_ITEMS,
  HOME_MAX_HIGHLIGHTS,
  type HomeAboutDocument,
  type HomeCategoriesDocument,
  type HomeCategoryItemDocument,
  type HomeContentDocuments,
  type HomeDictionary,
  type HomeFacadeDocument,
  type HomeFeaturedDocument,
  type HomePortalCtaDocument,
  type HomeSectionId,
  type LocalizedText,
} from "@/modules/home/lib/home-content";
import { interpolate } from "@/shared/lib/interpolate";
import { isSafeHref } from "@/shared/lib/safe-href";

export { HOME_FEATURED_LIMIT, HOME_MAX_CATEGORY_ITEMS, HOME_MAX_HIGHLIGHTS };

/** As cinco seções editáveis (o hero tem editor próprio, em `/portal/hero`). */
export type EditableSection = HomeSectionId;

export type SectionFormMap = {
  facade: HomeFacadeDocument;
  about: HomeAboutDocument;
  categories: HomeCategoriesDocument;
  featured: HomeFeaturedDocument;
  portalCta: HomePortalCtaDocument;
};

export type HighlightForm = NonNullable<HomeAboutDocument["highlights"]>[number];

export type LayoutItem = { id: HomeSectionId; enabled: boolean };

// ---------------------------------------------------------------------------
// Valores iniciais
// ---------------------------------------------------------------------------

function emptyText(): LocalizedText {
  return { pt: "", en: "" };
}

const EMPTY_FORMS: { [K in EditableSection]: () => SectionFormMap[K] } = {
  facade: () => ({
    imageKey: null,
    imageAlt: emptyText(),
    eyebrow: emptyText(),
    headline: emptyText(),
    text: emptyText(),
    showCta: true,
    ctaLabel: emptyText(),
    ctaHref: "",
  }),
  about: () => ({
    eyebrow: emptyText(),
    headline: emptyText(),
    paragraphs: emptyText(),
    highlights: null,
    showCatalogStats: true,
    ctaLabel: emptyText(),
    ctaHref: "",
  }),
  categories: () => ({
    eyebrow: emptyText(),
    headline: emptyText(),
    description: emptyText(),
    ctaLabel: emptyText(),
    ctaHref: "",
    items: null,
  }),
  featured: () => ({
    eyebrow: emptyText(),
    headline: emptyText(),
    description: emptyText(),
    emptyState: emptyText(),
    ctaLabel: emptyText(),
    ctaHref: "",
    limit: HOME_FEATURED_LIMIT.default,
  }),
  portalCta: () => ({
    headline: emptyText(),
    description: emptyText(),
    ctaLabel: emptyText(),
    ctaHref: "",
  }),
};

/** Formulário "tudo em branco" = a seção usando 100% o padrão do dicionário. */
export function emptyForm<K extends EditableSection>(section: K): SectionFormMap[K] {
  return EMPTY_FORMS[section]();
}

/** Documento salvo da seção, ou o formulário em branco quando não há nada salvo. */
export function baseFormFor<K extends EditableSection>(
  section: K,
  documents: HomeContentDocuments
): SectionFormMap[K] {
  return (documents[section] as SectionFormMap[K] | null) ?? emptyForm(section);
}

export function emptyHighlight(): HighlightForm {
  return { label: emptyText(), value: emptyText() };
}

export function emptyCategoryItem(): HomeCategoryItemDocument {
  return { label: emptyText(), href: "", imageKey: null, imagePath: null, alt: emptyText() };
}

// ---------------------------------------------------------------------------
// Padrões do dicionário (placeholders e pré-preenchimento de listas)
// ---------------------------------------------------------------------------

export type HomeEditorLocaleDefaults = {
  facade: {
    eyebrow: string;
    headline: string;
    text: string;
    imageAlt: string;
    ctaLabel: string;
    ctaHref: string;
  };
  about: {
    eyebrow: string;
    headline: string;
    /** Parágrafos do dicionário unidos por linha em branco (o formato do editor). */
    paragraphs: string;
    ctaLabel: string;
    ctaHref: string;
    highlights: { label: string; value: string }[];
  };
  categories: {
    eyebrow: string;
    headline: string;
    description: string;
    ctaLabel: string;
    ctaHref: string;
    items: { label: string; href: string; image: string; alt: string }[];
  };
  featured: {
    eyebrow: string;
    headline: string;
    description: string;
    emptyState: string;
    ctaLabel: string;
    ctaHref: string;
  };
  portalCta: {
    headline: string;
    description: string;
    ctaLabel: string;
    ctaHref: string;
  };
};

export type HomeEditorDefaults = Record<Locale, HomeEditorLocaleDefaults>;

/**
 * Extrai do dicionário `home` só o que o editor mostra como padrão — o
 * componente cliente recebe isso (poucos KB) em vez do dicionário inteiro.
 */
export function pickLocaleDefaults(home: HomeDictionary): HomeEditorLocaleDefaults {
  return {
    facade: {
      eyebrow: home.facade.eyebrow,
      headline: home.facade.headline,
      text: home.facade.text,
      imageAlt: home.facade.imageAlt,
      ctaLabel: home.facade.cta.label,
      ctaHref: home.facade.cta.href,
    },
    about: {
      eyebrow: home.about.eyebrow,
      headline: home.about.headline,
      paragraphs: home.about.paragraphs.join("\n\n"),
      ctaLabel: home.about.cta.label,
      ctaHref: home.about.cta.href,
      highlights: home.about.highlights.map((item) => ({ label: item.label, value: item.value })),
    },
    categories: {
      eyebrow: home.categories.eyebrow,
      headline: home.categories.headline,
      description: home.categories.description,
      ctaLabel: home.categories.cta.label,
      ctaHref: home.categories.cta.href,
      items: home.categories.items.map((item) => ({
        label: item.label,
        href: item.href,
        image: item.image,
        alt: item.alt,
      })),
    },
    featured: {
      eyebrow: home.featured.eyebrow,
      headline: home.featured.headline,
      description: home.featured.description,
      emptyState: home.featured.emptyState,
      ctaLabel: home.featured.cta.label,
      ctaHref: home.featured.cta.href,
    },
    portalCta: {
      headline: home.portalCta.headline,
      description: home.portalCta.description,
      ctaLabel: home.portalCta.cta.label,
      ctaHref: home.portalCta.cta.href,
    },
  };
}

export function pickEditorDefaults(homes: Record<Locale, HomeDictionary>): HomeEditorDefaults {
  return { pt: pickLocaleDefaults(homes.pt), en: pickLocaleDefaults(homes.en) };
}

/**
 * Destaques padrão copiados para o formulário quando o operador decide
 * personalizar a lista (`null` = "usar os do dicionário"). Emparelha PT e EN
 * pela posição — as duas listas do dicionário têm a mesma ordem.
 */
export function prefillHighlights(defaults: HomeEditorDefaults): HighlightForm[] {
  return defaults.pt.about.highlights.map((item, index) => ({
    label: { pt: item.label, en: defaults.en.about.highlights[index]?.label ?? "" },
    value: { pt: item.value, en: defaults.en.about.highlights[index]?.value ?? "" },
  }));
}

/**
 * Cards padrão copiados para o formulário ao personalizar. A arte padrão
 * (`/images/home/categorias/*.jpg`) vai em `imagePath` — é exatamente o campo
 * que o schema reserva para isso; o operador só troca a imagem se quiser.
 */
export function prefillCategoryItems(defaults: HomeEditorDefaults): HomeCategoryItemDocument[] {
  return defaults.pt.categories.items.map((item, index) => ({
    label: { pt: item.label, en: defaults.en.categories.items[index]?.label ?? "" },
    href: item.href,
    imageKey: null,
    imagePath: item.image,
    alt: { pt: item.alt, en: defaults.en.categories.items[index]?.alt ?? "" },
  }));
}

// ---------------------------------------------------------------------------
// Utilitários de comparação e de lista
// ---------------------------------------------------------------------------

/**
 * Igualdade profunda insensível à ORDEM das chaves. Necessária porque o
 * documento salvo (ordem do schema zod) e o formulário em branco (ordem
 * escrita à mão) descrevem o mesmo conteúdo com chaves em ordens diferentes —
 * `JSON.stringify` acusaria diferença onde não há nenhuma.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((value, index) => deepEqual(value, b[index]));
  }

  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const leftKeys = Object.keys(left);
  if (leftKeys.length !== Object.keys(right).length) return false;
  return leftKeys.every(
    (key) => Object.prototype.hasOwnProperty.call(right, key) && deepEqual(left[key], right[key])
  );
}

/** Nova lista com o item de `from` movido para `to` (índices fora do intervalo devolvem a lista igual). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) return [...list];
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function setLayoutEnabled(layout: readonly LayoutItem[], id: HomeSectionId, enabled: boolean): LayoutItem[] {
  return layout.map((item) => (item.id === id ? { ...item, enabled } : item));
}

/** "29/09/2026 14:32" (pt) / "9/29/26, 2:32 PM" (en), no fuso do navegador; travessão se a data for inválida. */
export function formatSavedAt(value: string | Date, locale: Locale): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

/**
 * Quais produtos da vitrine ficam ACIMA do limite da home. Só conta quem o site
 * de fato exibe (publicado e ativo): um produto oculto não ocupa vaga, então
 * despublicar um destaque abre espaço para o seguinte.
 */
export function markOverLimit(
  items: readonly { published: boolean; active: boolean }[],
  limit: number
): boolean[] {
  let shown = 0;
  return items.map((item) => {
    if (!item.published || !item.active) return false;
    shown += 1;
    return shown > limit;
  });
}

// ---------------------------------------------------------------------------
// Imagens
// ---------------------------------------------------------------------------

export type ImagePreview =
  | { kind: "custom"; url: string | null }
  | { kind: "default"; url: string }
  | { kind: "none"; url: null };

/**
 * Qual imagem o site vai mostrar para o estado ATUAL do formulário: a enviada
 * pelo painel (`imageKey`, com URL pública se o servidor souber montá-la) ou a
 * arte padrão de `public/`. `url: null` em "custom" = enviada, mas sem URL de
 * pré-visualização (storage público não configurado no ambiente).
 */
export function resolveImagePreview({
  imageKey,
  defaultPath,
  imageUrls,
}: {
  imageKey: string | null;
  defaultPath: string | null;
  imageUrls: Readonly<Record<string, string>>;
}): ImagePreview {
  if (imageKey) return { kind: "custom", url: imageUrls[imageKey] ?? null };
  if (defaultPath) return { kind: "default", url: defaultPath };
  return { kind: "none", url: null };
}

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

/** Erros por campo, indexados pelo caminho do schema unido por ponto (`items.2.label.pt`). */
export type FieldErrors = Record<string, string>;

export type ValidationMessages = {
  /** `{max}` */
  tooLong: string;
  invalidHref: string;
  labelRequired: string;
  hrefRequired: string;
  imageRequired: string;
  invalid: string;
};

export function errorKey(...segments: (string | number)[]): string {
  return segments.join(".");
}

function hasText(value: LocalizedText): boolean {
  return value.pt.trim() !== "" || value.en.trim() !== "";
}

function messageForIssue(issue: z.core.$ZodIssue, messages: ValidationMessages): string {
  if (issue.code === "too_big") {
    return interpolate(messages.tooLong, { max: String(issue.maximum) });
  }
  if (issue.code === "custom" && issue.message === "invalid_href") return messages.invalidHref;
  return messages.invalid;
}

/** Links preenchidos e inseguros — o único erro mostrado ANTES da primeira tentativa de salvar. */
export function collectHrefErrors<K extends EditableSection>(
  section: K,
  form: SectionFormMap[K],
  messages: ValidationMessages
): FieldErrors {
  const errors: FieldErrors = {};
  const check = (key: string, value: string) => {
    if (value.trim() !== "" && !isSafeHref(value)) errors[key] = messages.invalidHref;
  };

  if (section === "categories") {
    const categories = form as HomeCategoriesDocument;
    categories.items?.forEach((item, index) => check(errorKey("items", index, "href"), item.href));
  }
  // As cinco seções têm um CTA com `ctaHref` (na fachada ele só vale com `showCta`,
  // mas um link inseguro já digitado continua sendo sinalizado).
  check("ctaHref", (form as { ctaHref: string }).ctaHref);
  return errors;
}

/**
 * Regras que o schema do servidor NÃO impõe, mas sem as quais o site descartaria
 * o item em silêncio (`resolveHomeContent` filtra destaque sem título e card
 * sem título, link ou imagem). Melhor avisar o operador agora do que ele
 * salvar e o card simplesmente não aparecer.
 */
function collectRenderabilityErrors<K extends EditableSection>(
  section: K,
  form: SectionFormMap[K],
  messages: ValidationMessages
): FieldErrors {
  const errors: FieldErrors = {};

  if (section === "about") {
    (form as HomeAboutDocument).highlights?.forEach((item, index) => {
      if (!hasText(item.label)) errors[errorKey("highlights", index, "label")] = messages.labelRequired;
    });
  }

  if (section === "categories") {
    (form as HomeCategoriesDocument).items?.forEach((item, index) => {
      if (!hasText(item.label)) errors[errorKey("items", index, "label")] = messages.labelRequired;
      if (item.href.trim() === "") errors[errorKey("items", index, "href")] = messages.hrefRequired;
      if (!item.imageKey && !item.imagePath) errors[errorKey("items", index, "image")] = messages.imageRequired;
    });
  }

  return errors;
}

export type SectionValidation<K extends EditableSection> = {
  /** Todos os problemas encontrados (vazio = pode salvar). */
  errors: FieldErrors;
  /** Payload normalizado pelo schema (texto aparado, padrões aplicados); `null` se houver erro. */
  data: SectionFormMap[K] | null;
};

/**
 * Valida o formulário com o MESMO schema do servidor + as regras de
 * "renderizável" acima. Os erros do schema têm prioridade sobre os extras no
 * mesmo campo (ex.: link inseguro vence "link obrigatório").
 */
export function validateSection<K extends EditableSection>(
  section: K,
  form: SectionFormMap[K],
  messages: ValidationMessages
): SectionValidation<K> {
  const schema: z.ZodType = HOME_CONTENT_SCHEMAS[section];
  const result = schema.safeParse(form);

  const errors: FieldErrors = {};
  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = errorKey(...issue.path.map((segment) => String(segment)));
      if (!(key in errors)) errors[key] = messageForIssue(issue, messages);
    }
  }
  for (const [key, message] of Object.entries(collectRenderabilityErrors(section, form, messages))) {
    if (!(key in errors)) errors[key] = message;
  }

  const hasErrors = Object.keys(errors).length > 0;
  return {
    errors,
    data: !hasErrors && result.success ? (result.data as SectionFormMap[K]) : null,
  };
}

export type MutationErrorMessages = {
  forbidden: string;
  imageMissing: string;
  saveFailed: string;
};

function readErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const data = (error as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) return undefined;
  const code = (data as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

/**
 * Mensagem localizada para o erro de uma mutação do editor (`TRPCClientError`).
 *
 *  - FORBIDDEN/UNAUTHORIZED → a UI já esconde as ações de quem não pode editar,
 *    então isto significa que a sessão perdeu o perfil no meio do caminho;
 *  - BAD_REQUEST cuja mensagem NÃO é JSON → erro de negócio do servidor. Hoje o
 *    único é "imagem não encontrada" (`homeContent.update` confere no bucket
 *    cada imagem nova). Erro de validação do zod chega como JSON (`[{…}]`) e
 *    cai no genérico — o formulário já valida com o mesmo schema antes de enviar;
 *  - qualquer outro → genérico.
 */
export function messageForMutationError(error: unknown, messages: MutationErrorMessages): string {
  const code = readErrorCode(error);
  if (code === "FORBIDDEN" || code === "UNAUTHORIZED") return messages.forbidden;
  if (code === "BAD_REQUEST") {
    const text = error instanceof Error ? error.message.trim() : "";
    if (text !== "" && !text.startsWith("[") && !text.startsWith("{")) return messages.imageMissing;
  }
  return messages.saveFailed;
}

/** O que mostrar na tela: tudo depois da 1ª tentativa de salvar; antes disso só os links inseguros. */
export function visibleErrors<K extends EditableSection>(
  section: K,
  form: SectionFormMap[K],
  messages: ValidationMessages,
  showAll: boolean
): FieldErrors {
  return showAll ? validateSection(section, form, messages).errors : collectHrefErrors(section, form, messages);
}
