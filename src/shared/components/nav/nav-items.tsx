"use client";

import type { CSSProperties, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { externalProps, isNavLinkActive, type NavLink } from "@/shared/lib/nav";

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
 * locale-prefixed from `resolveDestination`, including the contact link
 * (`/contato` is a real page since 2026-08-24 — it no longer opens a modal).
 * Styling is fully delegated to the caller.
 *
 * SEM ícones desde 2026-08-12 (padrão WEG, pedido do stakeholder): os ícones
 * lucide por item (PhoneCall/Headset/Package) davam larguras e alturas ópticas
 * diferentes a cada rótulo e desalinhavam a barra. O campo `icon` continua nos
 * dicionários e no tipo `NavLink` (é ignorado aqui) para não quebrar copy nem
 * exigir migração; a barra da WEG é só texto, uniforme.
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

  return (
    <>
      {links.map((link, index) => {
        const isActive = isNavLinkActive(link.href, pathname);
        const className = itemClassName(index, isActive);
        const style = itemStyle?.(index);

        return wrap(
          <a
            key={link.label}
            href={link.href}
            onClick={onSelect}
            className={className}
            style={style}
            aria-current={isActive ? "page" : undefined}
            {...externalProps(link.href)}
          >
            {link.label}
          </a>,
          link.label
        );
      })}
    </>
  );
}
