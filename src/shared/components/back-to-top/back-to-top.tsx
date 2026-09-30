"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/core/lib/utils";

/** A partir de quantos pixels rolados o botão aparece (~1 tela de conteúdo). */
const SHOW_AFTER_PX = 640;

/**
 * "Voltar ao topo" (spec 001, RF16) — aparece depois de ~1 tela de rolagem,
 * empilhado ACIMA do botão flutuante do WhatsApp (canto inferior direito),
 * com o mesmo alinhamento. Respeita `prefers-reduced-motion`: sem animação
 * de rolagem para quem pediu movimento reduzido.
 */
export function BackToTop({ label }: { label: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER_PX);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function handleClick() {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      title={label}
      // Fora da tela quando invisível: some também do foco (tabIndex -1), para
      // o teclado não parar num controle que não se vê.
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      className={cn(
        "fixed bottom-[5.25rem] right-[1.625rem] z-50 flex size-11 items-center justify-center rounded-full border border-white/15 bg-[#05070b]/80 text-white/85 shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur-md transition-all duration-300 hover:border-neon-cyan/60 hover:text-neon-cyan-bright md:bottom-[6.25rem] md:right-[2.125rem]",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
      )}
    >
      <ArrowUp className="size-5" aria-hidden />
    </button>
  );
}
