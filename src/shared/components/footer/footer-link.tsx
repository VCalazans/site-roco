"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useContactForm } from "@/shared/components/contact-form";
import { externalProps, isContactLink } from "@/shared/lib/nav";

type FooterLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
};

/**
 * Link do rodapé — pequeno Client Component porque um item ("Fale conosco",
 * "Ligamos pra você") precisa abrir o MESMO modal de contato do nav
 * (`useContactForm`) em vez de navegar; os demais são links normais (internos
 * ou externos). Mesma lógica de `NavItems`, simplificada para o rodapé (sem
 * ícones).
 */
export function FooterLink({ href, className, children }: FooterLinkProps) {
  const { open } = useContactForm();

  if (isContactLink(href)) {
    return (
      <button type="button" onClick={open} className={className}>
        {children}
      </button>
    );
  }

  return (
    <Link href={href} className={className} {...externalProps(href)}>
      {children}
    </Link>
  );
}
