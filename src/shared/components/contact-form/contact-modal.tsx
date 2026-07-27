"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";

export type ContactModalContent = {
  title: string;
  description: string;
  close: string;
  loading: string;
  unavailable: string;
  noscript: string;
  cnpjInvalid: string;
  cnpjPlaceholder: string;
  phonePlaceholder: string;
};

type ContactModalProps = {
  isOpen: boolean;
  onClose: () => void;
  content: ContactModalContent;
};

/**
 * TEMPORARIAMENTE DESATIVADO (incidente de segurança — 2026-07-23):
 * O embed do Mautic (`https://mautic.roco.com.br/form/generate.js?id=1`) foi
 * removido porque o servidor Mautic estava servindo JS malicioso (golpe ClickFix
 * "Win + R"). Enquanto o servidor não for limpo, o modal exibe uma mensagem de
 * indisponibilidade em vez de injetar o script remoto.
 *
 * Para reativar após o servidor estar seguro: restaurar a injeção do script e o
 * hook `useMauticEnhancements` (ver git história deste arquivo) e, de preferência,
 * adicionar uma CSP (`script-src`) em next.config.ts antes.
 */
// const MAUTIC_FORM_SRC = "https://mautic.roco.com.br/form/generate.js?id=1";

export function ContactModal({ isOpen, onClose, content }: ContactModalProps) {
  // Escape to close + lock body scroll while open.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  return (
    <div
      aria-hidden={!isOpen}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 transition-opacity duration-300"
      style={{
        opacity: isOpen ? 1 : 0,
        pointerEvents: isOpen ? "auto" : "none",
      }}
    >
      {/* Overlay */}
      <button
        type="button"
        aria-label={content.close}
        tabIndex={isOpen ? 0 : -1}
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/70 backdrop-blur-sm"
      />

      {/* Panel */}
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={content.title}
        animate={{ opacity: isOpen ? 1 : 0, y: isOpen ? 0 : 16, scale: isOpen ? 1 : 0.98 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0f16] p-6 shadow-[0_0_60px_rgba(53,217,255,0.12)] sm:p-8"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-white">{content.title}</h2>
            <p className="mt-1 text-sm text-white/70">{content.description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={content.close}
            className="flex-shrink-0 rounded-full border border-white/10 p-2 text-white/70 transition hover:bg-white/5 hover:text-white"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        {/* Embed do Mautic temporariamente desativado (ver comentário acima). */}
        <div className="mautic-form-wrap">
          <p className="text-sm text-white/70">{content.unavailable}</p>
        </div>
      </motion.div>
    </div>
  );
}
