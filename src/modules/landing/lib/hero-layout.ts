import type { Variants } from "framer-motion";

/**
 * Coordinates measured from the source .psd, expressed as percentages so the
 * live overlay stays aligned with the baked render at every width.
 *
 * BOARD 3224 x 1484 (ratio 2.1725).
 *
 * O board original era 3224x1724 e trazia a barra de nav e o logotipo PINTADOS
 * no topo do render. Como as duas páginas precisavam da mesma barra e a do
 * catálogo é HTML vivo (`SiteHeader`), a arte foi recortada em y=240 — logo
 * abaixo do filete neon que fecha a barra assada — e a barra viva passou a
 * flutuar sobre a cena, exatamente como no catálogo. O `hero-scene.jpg`
 * anterior, com a barra, continua recuperável no histórico do git.
 *
 * As coordenadas em Y foram reconvertidas por
 *     novo% = (antigo% × 1724 − 240) ÷ 1484
 * e as ALTURAS por
 *     nova% = antiga% × 1724 ÷ 1484
 * (X não muda: o recorte foi só vertical.)
 *
 * Não há mais entrada `nav`: o menu deixou de ser overlay posicionado e passou
 * a ser o `SiteHeader` compartilhado.
 */
export const POS = {
  copy: { left: "29.1%", top: "47.14%", width: "42%" },
  btnPrimary: { left: "34.8%", top: "75.84%", width: "17.6%", height: "10.22%" },
  btnSecondary: {
    left: "53.0%",
    top: "75.84%",
    width: "12.4%",
    height: "10.22%",
  },
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
