/**
 * Interpola placeholders `{chave}` em strings de dicionário
 * (ex.: `"{count} produtos encontrados"`). Mantido minúsculo de propósito —
 * os dicionários só usam placeholders simples, não aninhados.
 *
 * Compartilhado entre módulos (products, home) — antes vivia duplicado em
 * `products-explorer.tsx` (débito registrado no progress.md).
 */
export function interpolate(
  template: string,
  values: Record<string, string | number>
): string {
  return Object.entries(values).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
    template
  );
}
