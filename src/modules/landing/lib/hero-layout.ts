import type { Variants } from "framer-motion";

/**
 * Coordinates measured from the source .psd (canvas 3224 x 1724), expressed as
 * percentages so the live overlay stays aligned with the baked render at every
 * width. The render already contains the ROCO wordmark, the top nav bar and both
 * neon buttons; only the translatable text (nav labels, headline, paragraph) and
 * the clickable CTA hotspots are layered on top. The nav sits over the empty
 * right side of the baked glass bar, so extra links extend leftwards into it.
 */
export const POS = {
  nav: { top: "5.0%", right: "6.6%" },
  copy: { left: "29.1%", top: "54.5%", width: "42%" },
  btnPrimary: { left: "34.8%", top: "79.2%", width: "17.6%", height: "8.8%" },
  btnSecondary: { left: "53.0%", top: "79.2%", width: "12.4%", height: "8.8%" },
} as const;

/** Staggered fade-up used by the headline, paragraph and mobile CTAs. */
export const fade: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      delay: 0.15 * i,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  }),
};
