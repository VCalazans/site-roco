"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { cn } from "@/core/lib/utils";
import { NavItems } from "@/shared/components/nav/nav-items";
import { navLabelClass, type NavLink } from "@/shared/lib/nav";

type MobileMenuProps = {
  links: NavLink[];
  /** aria-label for the toggle when the menu is closed / open. */
  labels: { open: string; close: string };
};

/**
 * Mobile nav — painel FULL-WIDTH ancorado sob a faixa fixa do `SiteHeader`
 * (padrão WEG), no lugar do dropdown-cartão pequeno anterior: itens em coluna
 * com alvo de toque generoso (py-3.5), backdrop escurecendo a página e trava
 * de scroll do body enquanto aberto. Fecha em Escape, no backdrop, e ao
 * escolher qualquer item.
 *
 * `top-16 md:top-20` espelha a altura da faixa do header (h-16 / md:h-20);
 * se a altura da barra mudar lá, precisa mudar aqui junto.
 */
export function MobileMenu({ links, labels }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);

    // Trava o scroll da página enquanto o painel está aberto — sem isso o
    // conteúdo rola por baixo do backdrop e o menu "escapa" do dedo no toque.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={open ? labels.close : labels.open}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="relative z-50 flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
      >
        {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop: escurece o conteúdo e fecha no toque fora. */}
            <motion.button
              key="backdrop"
              type="button"
              aria-hidden
              tabIndex={-1}
              onClick={close}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-30 cursor-default bg-black/50"
            />

            <motion.div
              key="panel"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-x-0 top-16 z-40 flex max-h-[calc(100svh-4rem)] flex-col gap-1 overflow-y-auto border-b border-white/10 bg-[#05070b]/95 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl md:top-20"
            >
              <NavItems
                links={links}
                onSelect={close}
                itemClassName={(_index, isActive) =>
                  cn(
                    "rounded-xl px-4 py-3.5 text-ui hover:bg-white/5 active:bg-white/10",
                    navLabelClass(isActive, "menu")
                  )
                }
              />

              {/* Filete dual-tone fechando o painel, eco do filete da faixa. */}
              <div
                aria-hidden
                className="mt-2 h-px w-full bg-gradient-to-r from-neon-cyan/50 via-white/10 to-neon-amber/50"
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
