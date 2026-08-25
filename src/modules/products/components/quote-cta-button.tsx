"use client";

import Link from "next/link";
import { CONTACT_SEGMENT } from "@/core/config/site";
import type { Locale } from "@/i18n/config";

type Props = {
  label: string;
  /** Locale atual — usado para montar o link para `/{locale}/contato` quando
   *  `target !== "whatsapp"`. Ignorado no caso do WhatsApp (usa `href`). */
  locale: Locale;
  /** Slug do produto — vira `?produto=` no link de contato, para o form
   *  pré-carregar o contexto (nome/SKU resolvidos no servidor). */
  productSlug: string;
  /** Destino no caso `target="whatsapp"` (link externo, ignora `locale`/`productSlug`). */
  href?: string;
  /** Direção do CTA no detalhe do produto: para o formulário de contato
   *  (padrão, com o produto e o assunto "orçamento" pré-selecionados) ou
   *  direto pro WhatsApp. */
  target?: "contact" | "whatsapp";
};

/**
 * "Solicitar orçamento" no detalhe do produto. Leva para `/{locale}/contato`
 * JÁ com o produto (`?produto=slug`) e o assunto "orçamento" (`&assunto=quote`)
 * pré-selecionados — corrigido em 2026-08-24: antes ignorava a prop `href` e
 * sempre linkava para `/catalogo`, descartando o produto que a pessoa estava
 * olhando (débito herdado da migração de Mautic para RD Station em 2026-08-23,
 * quando `/contato` ainda não existia como página).
 */
export function QuoteCtaButton({ label, locale, productSlug, href, target = "contact" }: Props) {
  const finalHref =
    target === "whatsapp"
      ? (href ?? "")
      : `/${locale}/${CONTACT_SEGMENT}?produto=${encodeURIComponent(productSlug)}&assunto=quote`;

  return (
    <Link
      href={finalHref}
      target={target === "whatsapp" ? "_blank" : undefined}
      rel={target === "whatsapp" ? "noopener noreferrer" : undefined}
      className="btn-neon-grad w-fit"
    >
      {label}
    </Link>
  );
}
