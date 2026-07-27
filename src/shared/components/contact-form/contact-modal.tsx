"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useMauticEnhancements } from "./use-mautic-enhancements";

export type ContactModalContent = {
  title: string;
  description: string;
  close: string;
  loading: string;
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
 * Mautic form embed. `generate.js?id=1` injects the form markup at the location
 * of its own <script> tag, so we append the script into the container ref. The
 * script loads lazily on first open and the injected form is kept mounted across
 * open/close (the panel is never unmounted) so the embed runs only once.
 */
const MAUTIC_FORM_SRC = "https://mautic.roco.com.br/form/generate.js?id=1";

export function ContactModal({ isOpen, onClose, content }: ContactModalProps) {
  const formRef = useRef<HTMLDivElement>(null);
  const injected = useRef(false);

  // Mask + CNPJ validation layered onto the runtime-injected Mautic form.
  useMauticEnhancements(formRef, isOpen, {
    cnpjInvalid: content.cnpjInvalid,
    cnpjPlaceholder: content.cnpjPlaceholder,
    phonePlaceholder: content.phonePlaceholder,
  });

  // Lazy-inject the Mautic form script the first time the modal opens.
  useEffect(() => {
    if (!isOpen || injected.current || !formRef.current) return;
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = MAUTIC_FORM_SRC;
    script.async = true;
    formRef.current.appendChild(script);
    injected.current = true;
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

        {/* Mautic injects the form here */}
        <div ref={formRef} className="mautic-form-wrap">
          <p className="text-sm text-white/40">{content.loading}</p>
          <noscript>{content.noscript}</noscript>
        </div>
      </motion.div>
    </div>
  );
}
