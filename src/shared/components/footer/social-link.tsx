"use client";

import type { ReactNode } from "react";

type SocialLinkProps = {
  href: string;
  label: string;
  children: ReactNode;
};

/**
 * Ícone de rede social no rodapé. Todos são links externos (abrem em nova aba),
 * com ícone já fornecido pelo caller (lucide).
 */
export function SocialLink({ href, label, children }: SocialLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="flex size-8 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white/60 transition hover:border-neon-amber/60 hover:bg-neon-amber/10 hover:text-neon-amber-bright"
    >
      {children}
    </a>
  );
}
