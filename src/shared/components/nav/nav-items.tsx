"use client";

import type { CSSProperties, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Headset, Package, PhoneCall } from "lucide-react";
import {
  externalProps,
  isContactLink,
  isNavLinkActive,
  type NavLink,
} from "@/shared/lib/nav";

/**
 * Nav icons taken from the design (docs/Novos ícones_OK.psd and
 * docs/Layout pag catalogo_ok.psd): a phone-with-waves for "Ligamos pra você",
 * a headset for "Solicite um orçamento" and a package/box for "Força de Vendas".
 * Rendered via lucide (like every other icon here) so they inherit currentColor
 * and scale with the label's font-size.
 */
const NAV_ICONS: Record<string, typeof PhoneCall> = {
  call: PhoneCall,
  headset: Headset,
  sales: Package,
};

type NavItemsProps = {
  links: NavLink[];
  /** Called when a contact link is chosen (opens the contact modal). */
  onContact: () => void;
  /**
   * Per-index class name. Also receives whether the item's href matches the
   * current route (`isNavLinkActive`) so callers can hand it to
   * `navLabelClass` and highlight the truly active item — not a fixed index.
   */
  itemClassName: (index: number, isActive: boolean) => string;
  /** Optional per-index inline style (e.g. container-query font sizing). */
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
 * The nav labels shared by the desktop overlay and the mobile menu. A contact
 * link opens the modal instead of navigating; every other link is a plain anchor
 * (external hrefs open in a new tab). Styling is fully delegated to the caller;
 * icons scale with the item's font-size (1.25em) so one component fits both the
 * container-query desktop bar and the fixed-size mobile menu.
 */
export function NavItems({
  links,
  onContact,
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
        const Icon = link.icon ? NAV_ICONS[link.icon] : undefined;

        const content = Icon ? (
          <span className="inline-flex items-center gap-[0.45em]">
            <Icon
              aria-hidden
              className={
                isActive
                  ? "shrink-0 icon-glow-cyan"
                  : "shrink-0 icon-glow-amber"
              }
              style={{ width: "1.25em", height: "1.25em" }}
            />
            <span>{link.label}</span>
          </span>
        ) : (
          link.label
        );

        if (isContactLink(link.href)) {
          return wrap(
            <button
              key={link.label}
              type="button"
              onClick={() => {
                onSelect?.();
                onContact();
              }}
              className={className}
              style={style}
            >
              {content}
            </button>,
            link.label
          );
        }

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
            {content}
          </a>,
          link.label
        );
      })}
    </>
  );
}
