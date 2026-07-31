/**
 * Navigation primitives shared by every page (landing hero overlay, catalog
 * header, mobile menu). Kept in `shared/` because more than one module renders
 * the same nav; page-specific geometry stays with the page (see
 * `@/modules/landing/lib/hero-layout`).
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
