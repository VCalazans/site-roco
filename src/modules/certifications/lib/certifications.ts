import { z } from "zod";

/**
 * Selos de certificação (cadastro no portal, exibição no site) — regras puras.
 *
 * Vigência: `validUntil` é o ÚLTIMO dia em que o selo aparece (inclusive),
 * comparado com a data de hoje no fuso de Brasília. Vencido = some do site
 * sozinho; o portal avisa antes ("vence em breve").
 */

/** Uploads do portal: `site/certificacoes/<uuid>.<ext>` (prefixo público do bucket). */
export const CERTIFICATION_IMAGE_KEY_PREFIX = "site/certificacoes/";
const IMAGE_KEY_PATTERN =
  /^site\/certificacoes\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;
/** Arquivo estático de `public/images/certifications/` (o selo que já existia no site). */
const IMAGE_PATH_PATTERN = /^\/images\/certifications\/[a-z0-9-]+\.(jpg|jpeg|png|webp|svg)$/;

export const MAX_CERTIFICATIONS = 20;
/** Aviso no portal quando faltam até estes dias para vencer. */
export const EXPIRING_SOON_DAYS = 60;

export function isCertificationImageKey(value: unknown): value is string {
  return typeof value === "string" && IMAGE_KEY_PATTERN.test(value);
}

export function isCertificationImagePath(value: unknown): value is string {
  return typeof value === "string" && IMAGE_PATH_PATTERN.test(value);
}

/** Data de hoje (`YYYY-MM-DD`) no fuso de Brasília. */
export function todayInBrazil(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export type CertificationStatus = "noExpiry" | "valid" | "expiringSoon" | "expired";

export function certificationStatus(validUntil: string | null | undefined, today: string): CertificationStatus {
  if (!validUntil) return "noExpiry";
  if (validUntil < today) return "expired";
  return daysBetween(today, validUntil) <= EXPIRING_SOON_DAYS ? "expiringSoon" : "valid";
}

/** Aparece no site: ativo, com imagem e dentro da vigência. */
export function isCertificationVisible(
  certification: { active: boolean; validUntil: string | null; imageKey: string | null; imagePath: string | null },
  today: string
): boolean {
  return (
    certification.active &&
    Boolean(certification.imageKey || certification.imagePath) &&
    certificationStatus(certification.validUntil, today) !== "expired"
  );
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional()
    .transform((value) => value ?? null);

/** Campos editáveis no portal (criar e editar). */
export const certificationInputSchema = z
  .object({
    namePt: z.string().trim().min(2).max(120),
    nameEn: optionalText(120),
    notePt: optionalText(160),
    noteEn: optionalText(160),
    altPt: optionalText(240),
    altEn: optionalText(240),
    imageKey: z
      .string()
      .nullable()
      .optional()
      .transform((value) => value ?? null)
      .refine((value) => value === null || isCertificationImageKey(value), "Imagem inválida."),
    linkUrl: optionalText(500).refine(
      (value) => value === null || /^https:\/\/[^\s/$.?#][^\s]*$/i.test(value),
      "Use um link completo, começando com https://"
    ),
    validUntil: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    active: z.boolean().default(true),
  });

export type CertificationInput = z.output<typeof certificationInputSchema>;

/** Linha do banco → o que o site mostra no idioma da página. */
export type PublicCertification = {
  id: string;
  label: string;
  note: string;
  alt: string;
  imageUrl: string;
  linkUrl: string | null;
};

export function toPublicCertification(
  row: {
    id: string;
    namePt: string;
    nameEn: string | null;
    notePt: string | null;
    noteEn: string | null;
    altPt: string | null;
    altEn: string | null;
    linkUrl: string | null;
  },
  imageUrl: string,
  locale: "pt" | "en"
): PublicCertification {
  const label = (locale === "en" && row.nameEn) || row.namePt;
  return {
    id: row.id,
    label,
    note: (locale === "en" ? row.noteEn || row.notePt : row.notePt) ?? "",
    alt: (locale === "en" ? row.altEn || row.altPt : row.altPt) || label,
    imageUrl,
    linkUrl: row.linkUrl,
  };
}
