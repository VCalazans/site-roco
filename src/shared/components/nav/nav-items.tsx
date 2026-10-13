"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import { locales } from "@/i18n/config";
import { activeNavIndex, externalProps, type NavLink } from "@/shared/lib/nav";

type NavItemsProps = {
  links: NavLink[];
  /**
   * Per-index class name. Also receives whether the item's href matches the
   * current route (`isNavLinkActive`) so callers can hand it to
   * `navLabelClass` and highlight the truly active item — not a fixed index.
   */
  itemClassName: (index: number, isActive: boolean) => string;
  /** Optional per-index inline style. */
  itemStyle?: (index: number) => CSSProperties | undefined;
  /** Fired on any item activation — used by the mobile menu to close itself. */
  onSelect?: () => void;
  /**
   * Envelopa cada item. A barra horizontal usa `<li>` (a lista é `<ul>`, como
   * na referência da Archicode); o dropdown mobile renderiza os itens soltos.
   * Recebe a `key` porque quem envelopa passa a ser o elemento de topo.
   */
  wrapItem?: (node: ReactNode, key: string) => ReactNode;
};

/**
 * The nav labels shared by the desktop bar and the mobile menu. Every link is
 * a plain anchor (external hrefs open in a new tab); hrefs already arrive
 * locale-prefixed — and, for the lead-capture pages, tagged with the
 * `?origem=menu` of `siteNavLinks` (`@/shared/lib/nav`) — including the
 * contact link (`/contato` is a real page since 2026-08-24 — it no longer
 * opens a modal). Styling is fully delegated to the caller.
 *
 * SEM ícones desde 2026-08-12 (padrão WEG, pedido do stakeholder): os ícones
 * lucide por item (PhoneCall/Headset/Package) davam larguras e alturas ópticas
 * diferentes a cada rótulo e desalinhavam a barra. O campo `icon` continua nos
 * dicionários e no tipo `NavLink` (é ignorado aqui) para não quebrar copy nem
 * exigir migração; a barra da WEG é só texto, uniforme.
 *
 * ÚNICA exceção (pedido do stakeholder, 2026-10-13): o item da IA (`icon: "ai"`)
 * leva o brilho `Sparkles` — o mesmo da chamada "ROCO na sua IA" da home —,
 * pequeno (0,875 em, a altura do texto), na cor do rótulo e alinhado à linha de
 * base, para sinalizar a novidade sem mudar a altura nem o peso do item.
 */
export function NavItems({
  links,
  itemClassName,
  itemStyle,
  onSelect,
  wrapItem,
}: NavItemsProps) {
  const wrap = wrapItem ?? ((node: ReactNode) => node);
  const pathname = usePathname();
  // "Home" chega como `/` nu (é o que `isNavLinkActive` espera para acender o
  // item só na raiz). Para NAVEGAR, o `/` custaria um redirect do middleware a
  // cada clique — resolve para a raiz do locale atual.
  const currentLocale = locales.find((locale) => pathname.split("/")[1] === locale);
  const homeHref = currentLocale ? `/${currentLocale}` : "/";
  // UM único item marcado como página atual — ver `activeNavIndex`. Dois itens
  // podem levar à mesma página com intenções diferentes ("Contato" e "Ligamos
  // pra você" vão ambos para `/contato`) e acender os dois lê como defeito.
  const activeIndex = activeNavIndex(links, pathname);

  return (
    <>
      {links.map((link, index) => {
        const isActive = index === activeIndex;
        const className = itemClassName(index, isActive);
        const style = itemStyle?.(index);

        // Destino INTERNO usa `<Link>` (navegação client-side com prefetch):
        // até a spec 001 cada item era um `<a>` cru e todo clique no menu
        // recarregava o documento inteiro — header, fontes, providers —, o
        // principal motivo de a navegação não parecer fluida. Externo segue
        // `<a>` com nova aba (`externalProps`).
        const isExternal = link.href.startsWith("http");
        const content =
          link.icon === "ai" ? (
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="size-[0.875em] shrink-0" aria-hidden />
              {link.label}
            </span>
          ) : (
            link.label
          );
        const node = isExternal ? (
          <a
            key={link.label}
            href={link.href}
            onClick={onSelect}
            className={className}
            style={style}
            {...externalProps(link.href)}
          >
            {content}
          </a>
        ) : (
          <Link
            key={link.label}
            href={link.href === "/" ? homeHref : link.href}
            onClick={onSelect}
            className={className}
            style={style}
            aria-current={isActive ? "page" : undefined}
          >
            {content}
          </Link>
        );

        return wrap(node, link.label);
      })}
    </>
  );
}
