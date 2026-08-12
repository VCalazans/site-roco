/**
 * Navigation primitives shared by every page (home hero overlay, catalog
 * header, mobile menu). Kept in `shared/` because more than one module renders
 * the same nav; page-specific geometry stays with the page (see
 * `@/modules/home/lib/hero-layout`).
 */

/** A labelled destination — used by nav links and page CTAs. */
export type Cta = { label: string; href: string };

/**
 * `icon` is a key into the nav icon registry ("" / undefined = no icon).
 * `hidden` parks an item without deleting its copy — see `visibleNavLinks`.
 */
export type NavLink = {
  label: string;
  href: string;
  icon?: string;
  hidden?: boolean;
};

/**
 * Drops items flagged `hidden` in the dictionaries.
 *
 * Lets an item be parked without losing its label/icon/destination: flip
 * `"hidden": true` in `dictionaries/{pt,en}.json` and it disappears from every
 * nav (desktop bar, mobile menu, landing overlay); remove the flag to bring it
 * back. Every page must build its nav through this helper, or a parked item
 * would reappear on whichever page skipped it.
 */
export function visibleNavLinks<T extends NavLink>(links: readonly T[]): T[] {
  return links.filter((link) => !link.hidden);
}

/**
 * Tipografia dos rótulos de menu — ÚNICA fonte de verdade, usada pelos três
 * caminhos que renderizam nav no site: o overlay do hero da landing, a barra
 * de vidro do catálogo (`SiteHeader`) e o dropdown mobile.
 *
 * Antes cada caminho escrevia o seu: a landing media em `cqw` (que depende da
 * altura da janela) e o catálogo em `rem`, então o mesmo menu saía 20.16px na
 * home e 16px no catálogo a 1920x1080 — e o inverso a 1920x800. `text-nav`
 * depende só da largura da viewport, então os três passam a medir igual.
 *
 * O tom ciano marca o item da rota ATIVA (ver `isNavLinkActive`); os demais
 * ficam em âmbar — o mesmo pareamento dual-tone da marca que aparece no
 * render. Antes o ciano ia sempre para `index === 0` ("Home"), fixo,
 * independente da página — em `/produtos`, `/representantes` etc. "Home"
 * aparecia "ativo" mesmo sem ser a rota atual, o que não indicava nada de
 * verdade (padrão WEG: só o segmento realmente selecionado acende, ver
 * `docs/referencia weg/home/image3.png` e `image4.png`).
 *
 * LINHA ÚNICA sempre. O .psd desenha os rótulos em duas linhas, mas isso é
 * composição de pôster, não padrão de navegação web: rótulo quebrado dobra a
 * altura da linha, desalinha os itens entre si (uns com uma linha, outros com
 * duas) e piora a leitura. A referência aqui é a barra do site da Archicode —
 * lista horizontal, um rótulo por linha, espaçamento constante. Quando não
 * couber, o menu colapsa no hambúrguer (abaixo de `lg`) em vez de quebrar.
 *
 * @param isActive Se o link corresponde à rota atual (ver `isNavLinkActive`).
 * @param variant `"bar"` é o item da barra horizontal;
 *                `"menu"` alinha à esquerda e ocupa a largura toda (dropdown).
 */
export function navLabelClass(
  isActive: boolean,
  variant: "bar" | "menu" = "bar"
): string {
  const base = "text-nav whitespace-nowrap transition";
  const shape = variant === "bar" ? "" : "w-full text-left";
  const tone = isActive
    ? "text-glow-cyan text-neon-cyan-bright hover:opacity-90"
    : "text-glow-amber text-white/90 hover:text-white";

  return [base, shape, tone].filter(Boolean).join(" ");
}

/**
 * Se um link de nav corresponde à rota ATUAL — usado por `NavItems` para
 * decidir o tom (`navLabelClass`) de cada item com base no `pathname` real, em
 * vez de um índice fixo.
 *
 * - Links de contato (`#contato`) nunca "ativam": abrem um modal, não navegam.
 * - O link "Home" resolve para `href === "/"` (`resolveDestination` não
 *   prefixa com o locale, ver `core/config/site.ts`); ele conta como ativo
 *   tanto na raiz nua (`/`) quanto na raiz do locale (`/pt`, `/en`), já que o
 *   middleware nunca deixa a home renderizar em outra profundidade.
 * - Todo outro href já sai locale-prefixado de `resolveDestination`
 *   (`/pt/representantes`, `/pt/produtos`…); conta como ativo em match exato
 *   ou em qualquer rota aninhada por baixo dele (`/pt/produtos/algum-slug`).
 */
export function isNavLinkActive(href: string, pathname: string): boolean {
  if (isContactLink(href)) return false;

  if (href === "/") {
    return pathname === "/" || /^\/[^/]+\/?$/.test(pathname);
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Open external (http) links in a new tab; leave internal links as-is. */
export function externalProps(href: string) {
  return href.startsWith("http")
    ? ({ target: "_blank", rel: "noopener noreferrer" } as const)
    : {};
}

/** A link whose href targets the contact anchor opens the contact modal. */
export function isContactLink(href: string) {
  return href.startsWith("#contato");
}
