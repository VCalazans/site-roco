import type { Locale } from "@/i18n/config";

/**
 * Data do envio do pré-cadastro por extenso ("30 de setembro de 2026"), sempre
 * no fuso de Brasília: o servidor roda em UTC, e um envio perto da meia-noite
 * apareceria com o dia seguinte.
 */
export function formatSubmittedDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "pt-BR", {
    dateStyle: "long",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}
