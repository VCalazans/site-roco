"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { externalProps, isContactLink } from "@/shared/lib/nav";

type FooterLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
};

/**
 * Link do rodapé — quando o href é um "contato" (apontava para `#contato`
 * no antigo modal Mautic), agora leva para `/contato` (página dedicada
 * que será criada quando o destino do formulário for definido — pode ser
 * a integração com RD Station). Os demais itens são links normais.
 */
export function FooterLink({ href, className, children }: FooterLinkProps) {
  if (isContactLink(href)) {
    return (
      <Link href="/contato" className={className}>
        {children}
      </Link>
    );
  }

  return (
    <Link href={href} className={className} {...externalProps(href)}>
      {children}
    </Link>
  );
}
