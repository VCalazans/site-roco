const KB = 1024;
const MB = 1024 * KB;
const GB = 1024 * MB;

/**
 * Tamanho de arquivo em KB/MB/GB com o separador decimal do idioma
 * ("2,5 MB" / "2.5 MB"). Uma casa decimal abaixo de 10 da unidade; valor
 * inválido ou zero vira travessão.
 */
export function formatFileSize(bytes: number, locale: string): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  if (bytes < MB) {
    return `${Math.max(1, Math.round(bytes / KB)).toLocaleString(locale)} KB`;
  }
  const [value, unit] = bytes < GB ? [bytes / MB, "MB"] : [bytes / GB, "GB"];
  return `${value.toLocaleString(locale, { maximumFractionDigits: value >= 10 ? 0 : 1 })} ${unit}`;
}
