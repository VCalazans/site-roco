"use client";

import type { CSSProperties } from "react";
import { Headset, PhoneCall } from "lucide-react";
import {
  externalProps,
  isContactLink,
  type NavLink,
} from "@/modules/landing/lib/hero-layout";

/**
 * Nav icons taken from the design (docs/Novos ícones_OK.psd): a phone-with-waves
 * for "Ligamos pra você" and a headset for "Solicite um orçamento". Rendered via
 * lucide (like every other icon here) so they inherit currentColor and scale with
 * the label's font-size.
 */
const NAV_ICONS: Record<string, typeof PhoneCall> = {
  call: PhoneCall,
  headset: Headset,
};

type NavItemsProps = {
  links: NavLink[];
  /** Called when a contact link is chosen (opens the contact modal). */
  onContact: () => void;
  /** Per-index class name, so each layout keeps its own look. */
  itemClassName: (index: number) => string;
  /** Optional per-index inline style (e.g. container-query font sizing). */
  itemStyle?: (index: number) => CSSProperties | undefined;
  /** Fired on any item activation — used by the mobile menu to close itself. */
  onSelect?: () => void;
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
}: NavItemsProps) {
  return (
    <>
      {links.map((link, index) => {
        const className = itemClassName(index);
        const style = itemStyle?.(index);
        const Icon = link.icon ? NAV_ICONS[link.icon] : undefined;

        const content = Icon ? (
          <span className="inline-flex items-center gap-[0.45em]">
            <Icon
              aria-hidden
              className="shrink-0 icon-glow-amber"
              style={{ width: "1.25em", height: "1.25em" }}
            />
            <span>{link.label}</span>
          </span>
        ) : (
          link.label
        );

        if (isContactLink(link.href)) {
          return (
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
            </button>
          );
        }

        return (
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
        );
      })}
    </>
  );
}
