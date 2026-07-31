"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { MauticEmbed, type MauticFormCopy } from "./mautic-embed";

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
  form: MauticFormCopy;
};

type ContactModalProps = {
  isOpen: boolean;
  onClose: () => void;
  content: ContactModalContent;
};

/**
 * Embed do formulário Mautic — versão ENDURECIDA pós-incidente ClickFix (2026-07):
 * HTML estático + SDK self-hosted (ver `mautic-embed.tsx`), protegido por CSP.
 *
 * Toggle sem editar código: `NEXT_PUBLIC_CONTACT_FORM_ENABLED`.
 *   - ausente ou !== "false"  → formulário habilitado (padrão)
 *   - "false"                 → modal mostra `content.unavailable`
 * (NEXT_PUBLIC_* é embutido no build, então mudar o valor exige rebuild.)
 *
 * Rollback para o embed remoto original: `docs/ROLLBACK-mautic-embed.md`.
 */
const FORM_ENABLED = process.env.NEXT_PUBLIC_CONTACT_FORM_ENABLED !== "false";

export function ContactModal({ isOpen, onClose, content }: ContactModalProps) {
  // O embed do Mautic só entra no DOM depois da primeira abertura. Além de
  // economizar markup, isso garante que os ids `mauticform_<alias>…` sejam
  // únicos em páginas que já embutem o mesmo formulário inline (catálogo) —
  // ids duplicados fariam o SDK operar no form errado. Uma vez montado, o form
  // permanece no DOM para preservar o que o usuário digitou entre abre/fecha.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (isOpen) setMounted(true);
  }, [isOpen]);

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
        className="relative z-10 max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0f16] p-5 shadow-[0_0_60px_rgba(53,217,255,0.12)] sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-white">{content.title}</h2>
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

        {!FORM_ENABLED ? (
          <div className="mautic-form-wrap">
            <p className="text-sm text-white/70">{content.unavailable}</p>
          </div>
        ) : mounted ? (
          <MauticEmbed
            active={isOpen}
            variant="compact"
            content={content.form}
            enhancement={{
              cnpjInvalid: content.cnpjInvalid,
              cnpjPlaceholder: content.cnpjPlaceholder,
              phonePlaceholder: content.phonePlaceholder,
            }}
          />
        ) : null}
      </motion.div>
    </div>
  );
}
