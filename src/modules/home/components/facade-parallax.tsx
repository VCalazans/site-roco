"use client";

import { useRef, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";

/**
 * Parallax sutil da imagem da fachada: a imagem desliza ~8% mais devagar que
 * a rolagem enquanto a seção cruza a tela — sensação de profundidade sem
 * roubar a atenção do texto. Desligado para quem pede movimento reduzido.
 * A imagem é maior que a caixa (inset negativo) para o deslocamento nunca
 * revelar a borda.
 */
export function FacadeParallax({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-8%", "8%"]);

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden">
      <motion.div style={reduceMotion ? undefined : { y }} className="absolute -inset-y-[10%] inset-x-0">
        {children}
      </motion.div>
    </div>
  );
}
