import { or, sql, type AnyColumn, type SQL } from "drizzle-orm";

/**
 * Escapa os metacaracteres do LIKE/ILIKE (`\`, `%`, `_`) para que um termo
 * digitado pelo usuário seja tratado como literal — sem isso, `%a%b%c%`
 * multiplica o custo do scan e `_` vira curinga de um caractere (achado da
 * revisão de segurança de 2026-08-12 na busca pública; aqui reaproveitado
 * pelas buscas do portal).
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Troca caracteres de controle (C0 e DEL) por espaço. O Postgres recusa NUL
 * em texto (SQLSTATE 22021): sem isto, `?search=%00` virava 500 na listagem
 * pública e na API. Loop em vez de regex porque `no-control-regex` barra a
 * faixa `\u0000-\u001f` em expressão regular.
 */
export function stripControlChars(value: string): string {
  let result = "";
  for (const char of value) {
    const code = char.charCodeAt(0);
    result += code < 0x20 || code === 0x7f ? " " : char;
  }
  return result;
}

/** `%termo%` já escapado, pronto para `ilike`. */
export function containsPattern(value: string): string {
  return `%${escapeLikePattern(stripControlChars(value).trim())}%`;
}

/**
 * Acentos que a busca ignora, e o equivalente sem acento na MESMA posição —
 * alimenta o `translate()` do Postgres. Cobre o português (e o espanhol dos
 * nomes em EN/ES que venham do ERP). Sem a extensão `unaccent` de propósito:
 * criá-la exigiria uma migration com privilégio no banco de produção, e a
 * migration roda no boot do container.
 */
const ACCENTED = "áàâãäåéèêëíìîïóòôõöúùûüçñý";
const PLAIN = "aaaaaaeeeeiiiiooooouuuucny";

/** Minúsculas sem acento — o mesmo "dobramento" que o SQL aplica à coluna. */
export function foldAccents(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Teto de palavras por busca — limita o custo (cada palavra é um `LIKE`). */
export const MAX_SEARCH_TERMS = 6;

/**
 * Palavras da busca: separadas por espaço, sem vazias, no máximo `maxTerms`
 * (padrão `MAX_SEARCH_TERMS`; a listagem pública combina vários termos-chip e
 * passa um teto maior).
 */
export function splitSearchTerms(search: string, maxTerms: number = MAX_SEARCH_TERMS): string[] {
  return stripControlChars(search).trim().split(/\s+/).filter(Boolean).slice(0, maxTerms);
}

/**
 * Condição de busca "todas as palavras, em qualquer campo, sem ligar para
 * acento nem caixa": `flexivel gas` encontra "FLEXÍVEL PARA GÁS 1/2"". Cada
 * palavra precisa aparecer em PELO MENOS uma das colunas (AND entre palavras,
 * OR entre colunas). `undefined` quando não há termo.
 *
 * A coluna é dobrada no SQL (`translate(lower(col), …)`) e o termo em JS
 * (`foldAccents`) — os dois lados passam pela mesma normalização.
 */
export function matchAllTerms(
  search: string,
  columns: AnyColumn[],
  maxTerms: number = MAX_SEARCH_TERMS
): SQL | undefined {
  const terms = splitSearchTerms(search, maxTerms);
  if (terms.length === 0 || columns.length === 0) return undefined;

  const perTerm = terms.map((term) => {
    const pattern = containsPattern(foldAccents(term));
    const perColumn = columns.map(
      (column) => sql`translate(lower(coalesce(${column}, '')), ${ACCENTED}, ${PLAIN}) like ${pattern}`
    );
    return perColumn.length === 1 ? perColumn[0] : or(...perColumn)!;
  });

  return perTerm.length === 1 ? perTerm[0] : sql.join(perTerm.map((condition) => sql`(${condition})`), sql` and `);
}
