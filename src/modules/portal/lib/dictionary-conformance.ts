import enDictionary from "@/i18n/dictionaries/en.json";
import ptDictionary from "@/i18n/dictionaries/pt.json";
import type { PortalDictionary } from "./types";

/**
 * Guarda de COMPILAÇÃO: o namespace `portal` dos dois dicionários precisa
 * satisfazer `PortalDictionary`.
 *
 * `getPortalDictionary()` só faz um cast do dicionário para o tipo manual, então
 * uma chave que existe no tipo (e portanto nos componentes) mas faltou em
 * `pt.json` ou `en.json` só apareceria em runtime — como um texto `undefined`
 * na tela do idioma esquecido. Este arquivo nunca é importado (não entra em
 * nenhum bundle); existe para o `tsc`/`next build` falhar apontando a chave
 * que falta. Chaves EXTRAS nos JSONs (ex.: namespaces de outras telas) não
 * quebram nada.
 */
export const PORTAL_DICTIONARY_CONFORMANCE: readonly PortalDictionary[] = [
  ptDictionary.portal,
  enDictionary.portal,
];
