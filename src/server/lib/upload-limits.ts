/**
 * Tabela central de "quais `contentType` um campo de upload aceita, com que
 * teto de tamanho e que extensão de arquivo usar" — pura (sem tRPC/DB/R2),
 * pensada para ser testável em isolamento e reaproveitada por qualquer
 * router que faça upload 2-step (presign → PUT → confirm).
 *
 * Nasceu de um bug real (2026-08-24, ver decisionLog): `hero-slides.ts`
 * validava `presignUpload`/`confirmUpload` sempre contra os tipos de vídeo,
 * mesmo quando o upload era do campo de PÔSTER (que deveria aceitar
 * imagem) — era literalmente impossível fazer upload de um pôster. A causa
 * raiz era um único mapa de content-type compartilhado por dois campos com
 * regras diferentes; este módulo generaliza a solução: cada "campo de
 * upload" (`UploadField`) tem sua própria tabela de `{contentType →
 * {extension, maxBytes}}`, e nenhum router precisa duplicar esse mapa.
 */

export interface UploadLimit {
  /** Extensão de arquivo (sem ponto) usada para nomear a chave no R2. */
  extension: string;
  /** Teto de tamanho em bytes aceito para este `contentType` neste campo. */
  maxBytes: number;
}

/** Campos de upload conhecidos hoje. Adicionar aqui ao introduzir um novo. */
export type UploadField = "heroVideo" | "heroPoster" | "material";

const HERO_VIDEO_MAX_BYTES = 200 * 1024 * 1024; // hero vídeos podem ser maiores que imagens
const HERO_POSTER_MAX_BYTES = 10 * 1024 * 1024; // mesmo teto usado para imagens de produto
const MATERIAL_DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;
const MATERIAL_VIDEO_MAX_BYTES = 200 * 1024 * 1024;
const MATERIAL_IMAGE_MAX_BYTES = 20 * 1024 * 1024;

/** Tabela `contentType -> limite`, uma por campo de upload. */
const UPLOAD_LIMITS: Record<UploadField, Record<string, UploadLimit>> = {
  heroVideo: {
    "video/mp4": { extension: "mp4", maxBytes: HERO_VIDEO_MAX_BYTES },
    "video/webm": { extension: "webm", maxBytes: HERO_VIDEO_MAX_BYTES },
  },
  heroPoster: {
    "image/jpeg": { extension: "jpg", maxBytes: HERO_POSTER_MAX_BYTES },
    "image/png": { extension: "png", maxBytes: HERO_POSTER_MAX_BYTES },
    "image/webp": { extension: "webp", maxBytes: HERO_POSTER_MAX_BYTES },
  },
  material: {
    "application/pdf": { extension: "pdf", maxBytes: MATERIAL_DOCUMENT_MAX_BYTES },
    "video/mp4": { extension: "mp4", maxBytes: MATERIAL_VIDEO_MAX_BYTES },
    "video/webm": { extension: "webm", maxBytes: MATERIAL_VIDEO_MAX_BYTES },
    "image/jpeg": { extension: "jpg", maxBytes: MATERIAL_IMAGE_MAX_BYTES },
    "image/png": { extension: "png", maxBytes: MATERIAL_IMAGE_MAX_BYTES },
    "image/webp": { extension: "webp", maxBytes: MATERIAL_IMAGE_MAX_BYTES },
  },
};

/** Tipos de conteúdo aceitos por campo, na ordem declarada (útil para `z.enum(...)`). */
export function getAllowedContentTypes(field: UploadField): [string, ...string[]] {
  const types = Object.keys(UPLOAD_LIMITS[field]);
  return types as [string, ...string[]];
}

/** `null` se o `contentType` não é aceito neste campo. */
export function getUploadLimit(field: UploadField, contentType: string): UploadLimit | null {
  return UPLOAD_LIMITS[field][contentType] ?? null;
}

export function isContentTypeAllowed(field: UploadField, contentType: string): boolean {
  return contentType in UPLOAD_LIMITS[field];
}

/** `null` se o `contentType` não é aceito neste campo (chame `isContentTypeAllowed` antes se precisar diferenciar "tipo errado" de "tamanho errado"). */
export function getMaxBytes(field: UploadField, contentType: string): number | null {
  return getUploadLimit(field, contentType)?.maxBytes ?? null;
}

export function getExtension(field: UploadField, contentType: string): string | null {
  return getUploadLimit(field, contentType)?.extension ?? null;
}

/** `sizeBytes` precisa ser > 0 e não pode exceder o teto do `contentType` no campo. Tipo desconhecido = inválido. */
export function isSizeWithinLimit(field: UploadField, contentType: string, sizeBytes: number): boolean {
  const limit = getUploadLimit(field, contentType);
  if (!limit) return false;
  return sizeBytes > 0 && sizeBytes <= limit.maxBytes;
}
