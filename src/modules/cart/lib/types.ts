import type { Dictionary } from "@/i18n/get-dictionary";

/**
 * Formato da chave `cart` (nível raiz) nos dicionários — copy do carrinho de
 * cotação (`/{locale}/carrinho`). Alias direto (sem shape manual nem cast,
 * mesmo padrão de `getCatalogDictionary` em `@/modules/catalog/lib/types`):
 * `Dictionary` é a união dos tipos inferidos de `pt.json`/`en.json`, então
 * qualquer chave que falte (ou mude de forma) em um dos dois idiomas já
 * quebra o `tsc` aqui, sem precisar de verificação própria.
 */
export type CartDictionary = Dictionary["cart"];
