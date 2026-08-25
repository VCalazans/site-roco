"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { externalProps } from "@/shared/lib/nav";

type FooterLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
};

/**
 * Link do rodapé — href já chega locale-prefixado de `resolveDestination`
 * (inclusive `/contato`, página real desde 2026-08-24; deixou de ser um
 * atalho especial para um modal). Todo link é tratado igual.
 */
export function FooterLink({ href, className, children }: FooterLinkProps) {
  return (
    <Link href={href} className={className} {...externalProps(href)}>
      {children}
    </Link>
  );
}
