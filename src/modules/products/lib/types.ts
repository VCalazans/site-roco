import type { getPublicCategoryList, getPublicProductList } from "@/server/lib/public-products";

/**
 * Tipos derivados diretamente do retorno das funções `server-only` de
 * `@/server/lib/public-products`, em vez de duplicar o shape manualmente —
 * qualquer mudança nessas funções aparece como erro de tipo aqui, e não como
 * divergência silenciosa. `import type` é apagado em build (nunca executa o
 * módulo `server-only` no client), então é seguro reexportar para
 * Client Components (ex. `ProductsExplorer`).
 */
export type PublicProductItem = Awaited<ReturnType<typeof getPublicProductList>>["items"][number];

export type PublicCategory = Awaited<ReturnType<typeof getPublicCategoryList>>[number];
