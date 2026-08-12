"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { SiteHeader } from "@/shared/components/nav";
import type { NavLink } from "@/shared/lib/nav";
import { fade } from "@/modules/home/lib/hero-layout";
import {
  CatalogForm,
  type CatalogFormContent,
} from "@/modules/catalog/components/catalog-form";

/** Anchor the nav's contact links point at on this page. */
export const CATALOG_FORM_ANCHOR = "formulario";

const SCENE = "/images/catalog/catalog-scene.jpg";

export type CatalogContent = {
  brand: string;
  headline: string;
  description: string;
  sceneAlt: string;
  form: CatalogFormContent;
};

type CatalogHeroProps = {
  content: CatalogContent;
  navLinks: NavLink[];
  menuLabels: { open: string; close: string };
  pdfUrl: string;
  pdfFileName: string;
  privacyUrl?: string;
};

/**
 * Catalog page, built from `docs/Layout pag catalogo_ok.psd` (board 3224x1724).
 *
 * Unlike the landing hero — which is aspect-locked to the render so overlays can
 * sit on baked artwork — this page carries a real form, so only the *scene* is
 * reused as artwork (`catalog-scene.jpg`, the PSD's "remove this" layer) and the
 * whole foreground (nav bar, headline, paragraph, form, button) is live HTML
 * that reflows. The PSD's three-column rhythm is preserved on large screens:
 * copy on the left, the form just left of centre, and the catalog render on the
 * right kept clear by a spacer column.
 */
export function CatalogHero({
  content,
  navLinks,
  menuLabels,
  pdfUrl,
  pdfFileName,
  privacyUrl,
}: CatalogHeroProps) {
  return (
    <div className="relative min-h-[100svh] w-full bg-[#05070b]">
      {/* Scene — fixed so it stays put while the form scrolls on short screens */}
      <div className="fixed inset-0 z-0">
        <Image
          src={SCENE}
          alt={content.sceneAlt}
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        {/* Readability wash. The artwork is already near-black across its left
            half, so on desktop the gradient only needs to steady the copy area
            and must die out before ~62% — where the catalog render begins — or
            it dulls the very artwork the page is showing off. Phones still get
            a flat wash, since the stacked content sits directly over it. */}
        <div className="absolute inset-0 bg-[#05070b]/60 md:bg-gradient-to-r md:from-[#05070b]/75 md:via-[#05070b]/25 md:via-42% md:to-transparent md:to-62%" />
      </div>

      <SiteHeader
        brand={content.brand}
        links={navLinks}
        menuLabels={menuLabels}
      />

      <main className="relative z-10 mx-auto grid min-h-[100svh] w-full max-w-[100rem] grid-cols-1 items-center gap-4 px-5 pt-20 pb-6 sm:px-6 md:pt-28 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,24rem)_minmax(0,0.9fr)] lg:gap-10 lg:px-[4vw] lg:pb-12">
        <motion.div
          variants={fade}
          initial="hidden"
          animate="show"
          custom={0}
          className="max-w-xl"
        >
          <h1 className="text-glow-soft font-display text-h1 text-white">
            {content.headline}
          </h1>
          <p className="mt-3 text-lede text-white/80 lg:mt-4">
            {content.description}
          </p>
        </motion.div>

        <motion.div
          id={CATALOG_FORM_ANCHOR}
          variants={fade}
          initial="hidden"
          animate="show"
          custom={1}
          className="w-full scroll-mt-24"
        >
          <CatalogForm
            content={content.form}
            pdfUrl={pdfUrl}
            pdfFileName={pdfFileName}
            privacyUrl={privacyUrl}
          />
        </motion.div>

        {/* Keeps the catalog render on the right visible on large screens. */}
        <div className="hidden lg:block" aria-hidden />
      </main>
    </div>
  );
}
