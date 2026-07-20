"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { cn } from "@/core/lib/utils";
import { NavItems } from "@/modules/landing/components/nav-items";
import type { NavLink } from "@/modules/landing/lib/hero-layout";

type MobileMenuProps = {
  links: NavLink[];
  onContact: () => void;
  /** aria-label for the toggle when the menu is closed / open. */
  labels: { open: string; close: string };
};

/**
 * Mobile nav. The top bar can't hold the full link list next to the logo, so on
 * phones the links collapse behind a toggle that reveals an animated dropdown.
 * Closes on outside click or Escape; picking any item closes it too.
 */
export function MobileMenu({ links, onContact, labels }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={open ? labels.close : labels.open}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="relative z-40 flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
      >
        {open ? (
          <X className="size-5" aria-hidden />
        ) : (
          <Menu className="size-5" aria-hidden />
        )}
      </button>

      {open && (
        <button
          type="button"
          aria-hidden
          tabIndex={-1}
          onClick={close}
          className="fixed inset-0 z-30 cursor-default"
        />
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-12 z-40 flex min-w-44 flex-col gap-1 rounded-2xl border border-white/10 bg-[#0a0f16]/95 p-2 shadow-[0_0_40px_rgba(53,217,255,0.12)] backdrop-blur"
          >
            <NavItems
              links={links}
              onContact={onContact}
              onSelect={close}
              itemClassName={(index) =>
                cn(
                  "rounded-xl px-4 py-2.5 text-left text-sm font-medium transition hover:bg-white/5",
                  index === 0
                    ? "text-neon-cyan-bright"
                    : "text-glow-amber text-white/90 hover:text-white",
                )
              }
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
