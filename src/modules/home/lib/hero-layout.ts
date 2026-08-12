import type { Variants } from "framer-motion";

/**
 * Animações do hero da home.
 *
 * As coordenadas medidas do .psd (`POS`) e os hotspots sobre os botões
 * "assados" no render foram aposentados em 2026-08-12, quando o hero passou a
 * usar o vídeo institucional como fundo e CTAs vivas centralizadas (padrão
 * WEG — ver decisionLog). Histórico completo no git.
 */

/** Staggered fade-up used by the eyebrow, headline, paragraph and CTAs. */
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
