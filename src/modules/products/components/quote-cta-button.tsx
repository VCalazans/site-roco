"use client";

import Link from "next/link";
import { useState } from "react";

type Props = {
  label: string;
  href: string;
  /** Direção do CTA no detalhe do produto: para `/catalogo` (download)
   *  ou direto pro WhatsApp. Padrão: `/catalogo`. */
  target?: "catalog" | "whatsapp";
};

/**
 * "Solicitar orçamento" no detalhe do produto (substituiu o antigo modal
 * de Mautic em 2026-08-23 quando o stakeholder decidiu sair do Mautic
 * e voltar para RD Station). Abre o catálogo em uma nova aba — lá o
 * visitante baixa o PDF e pode entrar em contato via WhatsApp flutuante.
 */
export function QuoteCtaButton({ label, href, target = "catalog" }: Props) {
  // Mantém `useState` por simetria futura (caso vire form de cotação
  // multi-item). Sem efeito hoje.
  const [, setOpen] = useState(false);
  const finalHref = target === "whatsapp" ? href : "/catalogo";

  return (
    <Link
      href={finalHref}
      target={target === "whatsapp" ? "_blank" : undefined}
      rel={target === "whatsapp" ? "noopener noreferrer" : undefined}
      className="btn-neon-grad w-fit"
      onClick={() => setOpen(true)}
    >
      {label}
    </Link>
  );
}
