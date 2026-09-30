/**
 * Biblioteca de materiais do REPRESENTANTE (revisão 2026-09-30): os materiais
 * publicados organizados por setor (categoria), com busca e destaque dos
 * recentes. Módulo puro — agrupamento, tipo de arquivo, busca e link de
 * download —, testável sem React nem banco.
 */

/**
 * Setores na ordem de exibição. `category` é texto livre no banco (ver
 * `src/db/schema/materials.ts`): valor fora desta lista, ou vazio, cai em
 * "other" — nenhum material publicado some por ter categoria inesperada.
 */
export const MATERIAL_CATEGORY_ORDER = [
  "commercial_policy",
  "logistics",
  "contacts",
  "training",
  "other",
] as const;

export type MaterialCategory = (typeof MATERIAL_CATEGORY_ORDER)[number];

export function normalizeMaterialCategory(value: string | null | undefined): MaterialCategory {
  const trimmed = value?.trim() ?? "";
  return (MATERIAL_CATEGORY_ORDER as readonly string[]).includes(trimmed) ? (trimmed as MaterialCategory) : "other";
}

/** Agrupa na ordem dos setores, mantendo a ordem de chegada dentro de cada um; setor vazio não aparece. */
export function groupMaterialsByCategory<T extends { category: string | null }>(
  items: readonly T[]
): { category: MaterialCategory; items: T[] }[] {
  const groups = new Map<MaterialCategory, T[]>();
  for (const item of items) {
    const category = normalizeMaterialCategory(item.category);
    const list = groups.get(category) ?? [];
    list.push(item);
    groups.set(category, list);
  }
  return MATERIAL_CATEGORY_ORDER.flatMap((category) => {
    const list = groups.get(category);
    return list && list.length > 0 ? [{ category, items: list }] : [];
  });
}

export type MaterialKind =
  | "pdf"
  | "video"
  | "image"
  | "spreadsheet"
  | "presentation"
  | "document"
  | "archive"
  | "file";

/** Tipo "humano" do arquivo a partir do content-type gravado no upload. */
export function materialKind(contentType: string): MaterialKind {
  const type = contentType.toLowerCase();
  if (type === "application/pdf") return "pdf";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("image/")) return "image";
  if (type.includes("spreadsheet") || type === "application/vnd.ms-excel") return "spreadsheet";
  if (type.includes("presentation") || type === "application/vnd.ms-powerpoint") return "presentation";
  if (type.includes("wordprocessing") || type === "application/msword") return "document";
  if (type.includes("zip")) return "archive";
  return "file";
}

/**
 * Tipos que o navegador abre sozinho: o botão principal ABRE (inline) em vez
 * de forçar o download. Planilha/apresentação/ZIP sempre baixam.
 */
export function opensInBrowser(kind: MaterialKind): boolean {
  return kind === "pdf" || kind === "video" || kind === "image";
}

/** Minúsculas sem acento — a busca ignora acento e caixa ("politica" acha "Política"). */
function fold(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Todas as palavras da busca aparecem no título ou na descrição (PT ou EN). */
export function matchesMaterialSearch(
  item: {
    titlePt: string;
    titleEn: string | null;
    descriptionPt: string | null;
    descriptionEn: string | null;
  },
  query: string
): boolean {
  const terms = fold(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = fold([item.titlePt, item.titleEn, item.descriptionPt, item.descriptionEn].filter(Boolean).join(" "));
  return terms.every((term) => haystack.includes(term));
}

/** Janela do selo "Novo". */
export const MATERIAL_NEW_DAYS = 14;

export function isRecentMaterial(publishedAt: string | Date | null | undefined, now: Date = new Date()): boolean {
  if (!publishedAt) return false;
  const published = new Date(publishedAt).getTime();
  if (Number.isNaN(published)) return false;
  const ageMs = now.getTime() - published;
  return ageMs >= 0 && ageMs <= MATERIAL_NEW_DAYS * 24 * 60 * 60 * 1000;
}

/** Tamanho em KB/MB com o separador decimal do idioma. */
export function formatFileSize(bytes: number, locale: string): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString(locale)} KB`;
  }
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes.toLocaleString(locale, { maximumFractionDigits: megabytes >= 10 ? 0 : 1 })} MB`;
}

/**
 * Link de leitura de um material. Passa pela rota autenticada
 * `/api/portal/materials/[id]/download`, que confere sessão e permissão e só
 * então redireciona para uma URL do R2 gerada NA HORA do clique. Antes a
 * página embutia URLs presignadas de 5 minutos: quem deixava a aba aberta e
 * clicava depois recebia um erro do R2 — o material parecia não existir.
 */
export function materialDownloadHref(id: string, mode: "inline" | "attachment"): string {
  return `/api/portal/materials/${encodeURIComponent(id)}/download?modo=${mode === "inline" ? "abrir" : "baixar"}`;
}
