"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import { ArrowRight, ClipboardCheck, ClipboardPlus } from "lucide-react";
import { cn } from "@/core/lib/utils";
import { quotePath } from "@/core/config/site";
import { addItem, useCartItems } from "@/shared/lib/cart-store";
import { interpolate } from "@/shared/lib/interpolate";
import type { Locale } from "@/i18n/config";

/** Mesmo shape de `dictionary.cart.addButton` — reaproveitado direto. */
export type AddToCartLabels = {
  label: string;
  added: string;
  /** "No orçamento ({count})" — `{count}` = unidades já na lista. */
  inQuote: string;
  viewQuote: string;
};

type AddToCartButtonProps = {
  slug: string;
  name: string;
  sku: string;
  /** Capa do produto — miniatura na página "Meu orçamento". */
  image?: string;
  locale: Locale;
  labels: AddToCartLabels;
  /**
   * `"card"` (padrão): botão de largura total no rodapé do `ProductCard`.
   * `"detail"`: botão `.btn-neon` completo no detalhe do produto, com atalho
   * "Ver orçamento" quando o item já está na lista.
   */
  variant?: "card" | "detail";
  className?: string;
};

const FEEDBACK_MS = 1600;

/**
 * "Adicionar ao orçamento" (antes "Adicionar ao carrinho" — spec 001, RF22/
 * RF24). Client Component pequeno e isolado; usado dentro do `ProductCard`
 * (Server Component) e no detalhe do produto.
 *
 * Três estados visíveis: normal; "Adicionado ao orçamento!" logo após o
 * clique; e "No orçamento (n)" quando o produto já está na lista — a pessoa
 * vê de relance o que já separou, sem abrir a página do orçamento. Um novo
 * clique continua SOMANDO uma unidade (o ajuste fino fica na página).
 */
export function AddToCartButton({ slug, name, sku, image, locale, labels, variant = "card", className }: AddToCartButtonProps) {
  const items = useCartItems();
  const quantityInQuote = items.find((item) => item.slug === slug)?.quantity ?? 0;

  const [justAdded, setJustAdded] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    []
  );

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    // O card inteiro é um `<Link>` IRMÃO deste botão (nunca aninhado — botão
    // dentro de âncora é HTML inválido). `stopPropagation` é defensivo.
    event.preventDefault();
    event.stopPropagation();

    addItem({ slug, name, sku, image }, 1);

    setJustAdded(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setJustAdded(false), FEEDBACK_MS);
  }

  const inQuote = quantityInQuote > 0;
  const label = justAdded
    ? labels.added
    : inQuote
      ? interpolate(labels.inQuote, { count: quantityInQuote })
      : labels.label;
  const Icon = inQuote || justAdded ? ClipboardCheck : ClipboardPlus;

  if (variant === "detail") {
    return (
      <div className={cn("flex flex-wrap items-center gap-3", className)}>
        <button type="button" onClick={handleClick} className="btn-neon w-fit">
          <Icon className="size-4" aria-hidden />
          <span aria-live="polite">{label}</span>
        </button>
        {inQuote ? (
          <Link
            href={quotePath(locale)}
            className="inline-flex items-center gap-1.5 text-meta font-semibold text-neon-amber-bright underline-offset-4 transition hover:underline"
          >
            {labels.viewQuote}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        ) : null}
      </div>
    );
  }

  // Variante "card": botão de rodapé do card, largura total. `min-h` fixa a
  // altura para o rótulo que quebra em 2 linhas no card estreito do mobile
  // não desalinhar os cards de uma mesma fileira.
  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-center text-micro font-semibold leading-tight transition",
        inQuote || justAdded
          ? "border-neon-amber/60 bg-neon-amber/10 text-neon-amber-bright shadow-[0_0_18px_-6px_rgba(255,180,84,0.5)] hover:border-neon-amber hover:bg-neon-amber/15"
          : "border-neon-cyan/35 bg-neon-cyan/[0.06] text-neon-cyan-bright hover:border-neon-cyan hover:bg-neon-cyan/15 hover:shadow-[0_0_18px_-6px_rgba(53,217,255,0.5)]",
        className
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span aria-live="polite">{label}</span>
    </button>
  );
}
