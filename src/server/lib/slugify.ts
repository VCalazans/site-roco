/**
 * Slug ASCII simples (sem acentos), usado para `products.slug` e
 * `categories.slug`. Mantido puro/sem dependências para ser reaproveitado
 * pelo importador do catálogo (`src/db/import`), que roda fora do bundler
 * do Next (imports relativos, ver `src/db/seed.ts`).
 */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}
