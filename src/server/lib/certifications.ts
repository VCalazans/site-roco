import "server-only";
import { unstable_cache } from "next/cache";
import { asc } from "drizzle-orm";
import { getPublicUrl } from "@/core/storage/r2";
import { db } from "@/db";
import { certifications } from "@/db/schema";
import type { Locale } from "@/i18n/config";
import {
  isCertificationVisible,
  todayInBrazil,
  toPublicCertification,
  type PublicCertification,
} from "@/modules/certifications/lib/certifications";

/** Tag de cache — toda mutação do portal expira na hora. */
export const CERTIFICATIONS_CACHE_TAG = "certifications";

const getCachedCertificationRows = unstable_cache(
  async () =>
    db
      .select()
      .from(certifications)
      .orderBy(asc(certifications.sortOrder), asc(certifications.createdAt)),
  ["certifications-all"],
  { tags: [CERTIFICATIONS_CACHE_TAG], revalidate: 300 }
);

/** URL da imagem: upload do portal (bucket público) ou arquivo de `public/`. */
export function certificationImageUrl(row: { imageKey: string | null; imagePath: string | null }): string | null {
  if (row.imageKey) {
    try {
      return getPublicUrl(row.imageKey);
    } catch {
      return null;
    }
  }
  return row.imagePath;
}

/**
 * Selos que o site mostra AGORA: ativos, com imagem e dentro da vigência. A
 * data é conferida a cada chamada (fora do cache), então o selo some no dia
 * seguinte ao vencimento mesmo sem ninguém mexer no portal. Banco fora: lista
 * vazia (o rodapé só omite a faixa).
 */
export async function getPublicCertifications(locale: Locale): Promise<PublicCertification[]> {
  let rows: Awaited<ReturnType<typeof getCachedCertificationRows>>;
  try {
    rows = await getCachedCertificationRows();
  } catch (error) {
    console.error("[certifications] Falha ao ler os selos:", error instanceof Error ? error.message : error);
    return [];
  }
  const today = todayInBrazil();
  return rows.flatMap((row) => {
    if (!isCertificationVisible(row, today)) return [];
    const imageUrl = certificationImageUrl(row);
    return imageUrl ? [toPublicCertification(row, imageUrl, locale)] : [];
  });
}
