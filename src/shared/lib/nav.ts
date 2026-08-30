/**
 * Navigation primitives shared by every page (home hero overlay, catalog
 * header, mobile menu). Kept in `shared/` because more than one module renders
 * the same nav; page-specific geometry stays with the page (see
 * `@/modules/home/lib/hero-layout`).
 */
import { resolveDestination } from "@/core/config/site";

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
 * A nav pronta para renderizar: itens visíveis, com os placeholders do
 * dicionário (`#contato`, `#representantes`…) já resolvidos para a rota real
 * do locale e marcados com a origem `"menu"`.
 *
 * Existe porque a nav NÃO vive no layout — cada página monta a sua, e antes
 * disto o mesmo `.map(resolveDestination)` estava copiado em seis páginas.
 * Seis cópias significam seis lugares onde esquecer a origem (ou o locale)
 * passa despercebido; aqui é um lugar só.
 */
export function siteNavLinks<T extends NavLink>(links: readonly T[], locale: string): T[] {
  return visibleNavLinks(links).map((link) => ({
    ...link,
    href: resolveDestination(link.href, locale, "menu"),
  }));
}

/**
 * Tipografia dos rótulos de menu — ÚNICA fonte de verdade, usada pela barra
 * fixa (`SiteHeader`) e pelo painel mobile.
 *
 * Padrão WEG desde 2026-08-12 (pedido do stakeholder: itens uniformes, sem os
 * desalinhamentos que os ícones e os glows criavam): TODOS os itens medem e
 * pesam igual — caixa alta, tracking constante, mesma cor de base — e o único
 * diferencial do item ATIVO é o tom ciano da marca (ver `isNavLinkActive`).
 * Os text-glows saíram dos rótulos: sombra de neon borrava o contorno dos
 * glifos e cada item parecia ter um peso diferente.
 *
 * LINHA ÚNICA sempre (rótulo quebrado desalinha a barra); quando não couber,
 * o menu colapsa no hambúrguer (abaixo de `lg`) em vez de quebrar.
 *
 * @param isActive Se o link corresponde à rota atual (ver `isNavLinkActive`).
 * @param variant `"bar"` é o item da barra horizontal;
 *                `"menu"` alinha à esquerda e ocupa a largura toda (painel).
 */
export function navLabelClass(
  isActive: boolean,
  variant: "bar" | "menu" = "bar"
): string {
  const base = "text-nav whitespace-nowrap uppercase tracking-[0.06em] transition-colors";
  const shape = variant === "bar" ? "" : "w-full text-left";
  const tone = isActive
    ? "text-neon-cyan-bright"
    : "text-white/85 hover:text-white";

  return [base, shape, tone].filter(Boolean).join(" ");
}

/**
 * Se um link de nav corresponde à rota ATUAL — usado por `NavItems` para
 * decidir o tom (`navLabelClass`) de cada item com base no `pathname` real, em
 * vez de um índice fixo.
 *
 * - O link "Home" resolve para `href === "/"` (`resolveDestination` não
 *   prefixa com o locale, ver `core/config/site.ts`); ele conta como ativo
 *   tanto na raiz nua (`/`) quanto na raiz do locale (`/pt`, `/en`), já que o
 *   middleware nunca deixa a home renderizar em outra profundidade.
 * - Todo outro href já sai locale-prefixado de `resolveDestination`
 *   (`/pt/representantes`, `/pt/produtos`, `/pt/contato`…); conta como ativo
 *   em match exato ou em qualquer rota aninhada por baixo dele
 *   (`/pt/produtos/algum-slug`). O link de contato segue essa mesma regra
 *   desde que `/contato` virou uma página real (não abre mais modal).
 *
 * O href pode carregar querystring/fragmento (`/pt/contato?origem=menu` —
 * ver `@/shared/lib/lead-origin`), e o `pathname` NUNCA tem; sem descartar
 * essa cauda antes de comparar, o item "Contato" jamais ficaria ativo e
 * perderia o `aria-current="page"` — regressão de a11y, não só de cor.
 */
export function isNavLinkActive(href: string, pathname: string): boolean {
  const path = hrefPathname(href);

  if (path === "/") {
    return pathname === "/" || /^\/[^/]+\/?$/.test(pathname);
  }

  return pathname === path || pathname.startsWith(`${path}/`);
}

/** O caminho de um href, sem querystring nem fragmento. */
function hrefPathname(href: string): string {
  return href.split("#")[0].split("?")[0];
}

/** Open external (http) links in a new tab; leave internal links as-is. */
export function externalProps(href: string) {
  return href.startsWith("http")
    ? ({ target: "_blank", rel: "noopener noreferrer" } as const)
    : {};
}
