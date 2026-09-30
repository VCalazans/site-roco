"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { cn } from "@/core/lib/utils";
import { productsPath } from "@/core/config/site";
import type { Locale } from "@/i18n/config";

/** `dictionary.navigation.search` — nunca hardcode. */
export type HeaderSearchLabels = {
  open: string;
  label: string;
  placeholder: string;
  submit: string;
  close: string;
};

/** Destino da busca: a listagem já filtrada (`?search=`), ou a listagem inteira. */
export function productSearchHref(locale: string, term: string): string {
  const query = term.trim();
  return query ? `${productsPath(locale)}?search=${encodeURIComponent(query)}` : productsPath(locale);
}

type HeaderSearchProps = {
  locale: Locale;
  labels: HeaderSearchLabels;
  className?: string;
};

/**
 * Busca de produtos na barra do header (desktop) — padrão WEG ("Buscar por
 * produto, categoria ou código" no topo de toda página). O botão abre um
 * painel logo abaixo da faixa com o campo já focado; Enter leva à listagem
 * filtrada (`/produtos?search=`), onde a barra lateral assume a busca ao vivo.
 *
 * No mobile a busca mora DENTRO do painel do hambúrguer (`MobileMenu`): a
 * barra de 320px já divide espaço entre logotipo, orçamento, login e menu.
 */
export function HeaderSearch({ locale, labels, className }: HeaderSearchProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();
  const inputId = useId();

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    // Clique fora fecha — mas não o clique no próprio botão (ele alterna).
    const onPointer = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(productSearchHref(locale, term));
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={cn("items-center", className)}>
      <button
        type="button"
        aria-label={open ? labels.close : labels.open}
        title={open ? labels.close : labels.open}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex size-10 items-center justify-center rounded-full border text-white/85 transition hover:text-white",
          open
            ? "border-neon-cyan/60 bg-neon-cyan/10 text-neon-cyan-bright"
            : "border-white/15 bg-white/5 hover:border-white/30 hover:bg-white/10"
        )}
      >
        {open ? <X className="size-[18px]" aria-hidden /> : <Search className="size-[18px]" aria-hidden />}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            key="search-panel"
            id={panelId}
            role="search"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-x-0 top-full z-40 border-b border-white/10 bg-[#05070b]/95 shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl"
          >
            <form onSubmit={handleSubmit} className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-4 sm:px-6">
              <label htmlFor={inputId} className="sr-only">
                {labels.label}
              </label>
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/40"
                  aria-hidden
                />
                <input
                  ref={inputRef}
                  id={inputId}
                  type="search"
                  value={term}
                  onChange={(event) => setTerm(event.target.value)}
                  placeholder={labels.placeholder}
                  autoComplete="off"
                  enterKeyHint="search"
                  maxLength={80}
                  className="w-full rounded-full border border-white/15 bg-white/5 py-3 pl-11 pr-4 text-body text-white outline-none transition placeholder:text-white/40 focus:border-neon-cyan focus:ring-2 focus:ring-neon-cyan/25"
                />
              </div>
              {/* `py-3!` (important): `.btn-neon` é CSS fora de @layer em
                  globals.css e venceria qualquer utilitário sem o `!`. */}
              <button type="submit" className="btn-neon shrink-0 py-3!">
                {labels.submit}
              </button>
            </form>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
