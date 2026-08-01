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
  /**
   * CENTRO vertical do bloco de rótulos (o <nav> usa `-translate-y-1/2`), não
   * o topo. Medido no render: centro do primeiro item ÷ altura do board deu
   * 6.749% / 6.755% / 6.784% / 6.725% em 1920x1080, 1920x800, 1440x900 e
   * 2560x1440 — daí os 6.75%. Ancorar pelo centro é o que permite mudar o
   * tamanho da fonte do menu sem deslocar os rótulos dentro do vidro pintado.
   */
  nav: { top: "6.75%", right: "6.6%" },
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
