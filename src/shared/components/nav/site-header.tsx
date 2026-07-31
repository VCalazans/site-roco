"use client";

import Image from "next/image";
import { useContactForm } from "@/shared/components/contact-form";
import { MobileMenu } from "@/shared/components/nav/mobile-menu";
import { NavItems } from "@/shared/components/nav/nav-items";
import type { NavLink } from "@/shared/lib/nav";

const LOGO = "/images/hero/roco-logo-white.png";

type SiteHeaderProps = {
  brand: string;
  links: NavLink[];
  menuLabels: { open: string; close: string };
};

/**
 * The ROCO glass nav bar, rebuilt as live HTML/CSS.
 *
 * The landing hero overlays its labels on the bar that is baked into the render
 * (`hero-scene.jpg`); pages that are not aspect-locked to the 3224x1724 board —
 * such as the catalog page — need a bar that reflows, so the same design is
 * reproduced with CSS gradients (`.nav-glass` in globals.css). Measurements come
 * from `docs/Layout pag catalogo_ok.psd` ("Agrupar 1", 3144x190 at 43,25):
 * side margins ~1.3% of the board, bar height ~11% of its own width, labels
 * right-aligned and wrapping to two lines.
 */
export function SiteHeader({ brand, links, menuLabels }: SiteHeaderProps) {
  const { open: openContact } = useContactForm();

  return (
    <header className="absolute inset-x-0 top-0 z-30 px-[1.3vw] pt-[1.4vw] max-md:px-3 max-md:pt-3">
      <div className="nav-glass flex items-center justify-between gap-4 px-5 py-3 md:px-8 lg:px-10">
        <a href="/" aria-label={brand} className="flex-shrink-0">
          <Image
            src={LOGO}
            alt={brand}
            width={300}
            height={122}
            priority
            className="h-8 w-auto md:h-10 lg:h-12"
          />
        </a>

        {/* Desktop: labels inline, right-aligned like the render */}
        <nav className="hidden items-center gap-5 md:flex lg:gap-8 xl:gap-10">
          <NavItems
            links={links}
            onContact={openContact}
            itemClassName={(index) =>
              index === 0
                ? "text-glow-cyan max-w-[7em] text-center text-sm font-medium leading-tight text-neon-cyan-bright transition hover:opacity-90 lg:text-base"
                : "text-glow-amber max-w-[7em] text-center text-sm font-medium leading-tight text-white/90 transition hover:text-white lg:text-base"
            }
          />
        </nav>

        {/* Mobile: collapsed behind the hamburger */}
        <div className="md:hidden">
          <MobileMenu
            links={links}
            onContact={openContact}
            labels={menuLabels}
          />
        </div>
      </div>
    </header>
  );
}
