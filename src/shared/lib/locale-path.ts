/**
 * Troca de idioma — lógica PURA de reescrita de caminho.
 *
 * Este site NÃO traduz os segmentos de rota: `/pt/produtos` e `/en/produtos`
 * usam o mesmo `PRODUCTS_SEGMENT` (ver `@/core/config/site`), e o mesmo vale
 * para `contato`, `catalogo`, `representantes` e `portal`. Trocar de idioma é,
 * portanto, trocar o PRIMEIRO segmento do caminho e preservar todo o resto —
 * inclusive querystring e fragmento, que carregam estado real da página
 * (`/pt/produtos?search=torneira&page=2`, `/pt/contato?produto=x&assunto=quote`).
 *
 * Mora num módulo próprio, sem React, para ser testável sem DOM: o componente
 * (`@/shared/components/nav/language-switcher`) só decide QUANDO chamar.
 *
 * ⚠️ Se algum dia os segmentos passarem a ser traduzidos (`/en/products`),
 * este módulo deixa de bastar — a troca teria de mapear segmento a segmento,
 * e o teste de "rota aninhada" abaixo é o lugar onde isso quebraria primeiro.
 */

/**
 * O primeiro segmento do caminho, quando ele é um locale conhecido.
 * `null` quando o caminho não tem prefixo de locale (`/`, `/contato`) — caso
 * que existe de verdade: o middleware redireciona, mas o componente pode
 * renderizar antes disso em ambientes onde ele não rodou.
 */
export function localeFromPath(
  path: string,
  knownLocales: readonly string[]
): string | null {
  const first = splitPath(path).path.split("/")[1] ?? "";
  return knownLocales.includes(first) ? first : null;
}

/**
 * Reescreve um caminho para outro locale, preservando o resto do caminho, a
 * querystring e o fragmento.
 *
 * Regras (todas cobertas por teste):
 *  - `/pt` → `/en`; `/pt/produtos/slug` → `/en/produtos/slug`;
 *  - querystring e fragmento sobrevivem, na ordem original;
 *  - caminho SEM locale (`/contato`) ganha o prefixo (`/en/contato`) em vez de
 *    perder o primeiro segmento — perder seria mandar a pessoa para outra
 *    página;
 *  - caminho JÁ no locale de destino volta idêntico (idempotente), o que
 *    mantém o botão inerte em vez de produzir uma URL torta;
 *  - entrada vazia vira `/{locale}`, e entrada sem barra inicial é
 *    normalizada para absoluta — o retorno nunca é um caminho relativo, que
 *    resolveria contra a rota atual e mandaria a pessoa para outro lugar.
 */
export function switchLocalePath(
  currentPath: string,
  targetLocale: string,
  knownLocales: readonly string[]
): string {
  const { path: raw, suffix } = splitPath(currentPath);

  if (raw === "") return `/${targetLocale}${suffix}`;

  const path = raw.startsWith("/") ? raw : `/${raw}`;
  const segments = path.split("/"); // ["", "pt", "produtos", …]
  const first = segments[1] ?? "";

  if (knownLocales.includes(first)) {
    segments[1] = targetLocale;
    return `${segments.join("/")}${suffix}`;
  }

  // `/` → `/en` (e não `/en/`); `/contato` → `/en/contato`.
  const rest = path === "/" ? "" : path;
  return `/${targetLocale}${rest}${suffix}`;
}

/**
 * O "outro" idioma de um par de dois locales — o alvo que o seletor oferece.
 *
 * Assume DOIS locales (é o caso da ROCO: pt/en) e é o padrão recomendado pelo
 * U.S. Web Design System para exatamente dois idiomas: um botão que mostra o
 * idioma de DESTINO, em vez de um dropdown. Com três ou mais locales esta
 * função precisa dar lugar a um menu — e o `?? current` abaixo garante que,
 * nesse dia, a UI fique inerte em vez de mandar a pessoa para um locale que
 * não existe.
 */
export function alternateLocale<T extends string>(
  current: string,
  knownLocales: readonly T[]
): T {
  return (knownLocales.find((locale) => locale !== current) ?? (current as T));
}

/** Separa o caminho da cauda (`?query#hash`), preservando a ordem. */
function splitPath(value: string): { path: string; suffix: string } {
  if (typeof value !== "string") return { path: "", suffix: "" };
  const cut = value.search(/[?#]/);
  return cut === -1
    ? { path: value, suffix: "" }
    : { path: value.slice(0, cut), suffix: value.slice(cut) };
}
