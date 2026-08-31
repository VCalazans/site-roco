"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/core/lib/utils";
import { addItem } from "@/shared/lib/cart-store";
import type { Locale } from "@/i18n/config";

/** Mesmo shape de `dictionary.cart.addButton` — reaproveitado direto, sem
 *  remapear chaves. */
export type AddToCartLabels = { label: string; added: string };

type AddToCartButtonProps = {
  slug: string;
  name: string;
  sku: string;
  /** Recebido para manter o contrato pedido pela feature; o item já guarda
   *  nome/SKU no idioma resolvido pelo componente que renderiza — nada aqui
   *  varia por locale hoje (fica disponível para uso futuro, ex. telemetria,
   *  sem precisar mudar a assinatura). */
  locale: Locale;
  labels: AddToCartLabels;
  /**
   * `"card"` (padrão): pílula pequena — cabe no rodapé apertado do
   * `ProductCard` (ícone sempre visível, rótulo só a partir de `sm`).
   * `"detail"`: pílula `.btn-neon` inteira, para ficar ao lado do CTA de
   * orçamento no detalhe do produto.
   */
  variant?: "card" | "detail";
  className?: string;
};

const FEEDBACK_MS = 1500;

/**
 * Botão "adicionar ao carrinho" — Client Component pequeno e isolado (regra
 * do projeto: interatividade nunca sobe para a árvore inteira). Usado dentro
 * de `ProductCard` (Server Component) e no detalhe do produto, ao lado de
 * `QuoteCtaButton`.
 */
export function AddToCartButton({
  slug,
  name,
  sku,
  labels,
  variant = "card",
  className,
}: AddToCartButtonProps) {
  const [added, setAdded] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    []
  );

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    // `ProductCard` inteiro é clicável (um `<Link>` para o detalhe); este
    // botão fica por CIMA da imagem, como irmão do link (nunca aninhado nele
    // — botão dentro de âncora é HTML inválido e dispararia os dois cliques).
    // `stopPropagation` é defensivo: impede que um clique aqui borbulhe para
    // qualquer handler de clique de um ancestral.
    event.preventDefault();
    event.stopPropagation();

    addItem({ slug, name, sku }, 1);

    setAdded(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setAdded(false), FEEDBACK_MS);
  }

  const label = added ? labels.added : labels.label;

  if (variant === "detail") {
    return (
      <button type="button" onClick={handleClick} className={cn("btn-neon w-fit", className)}>
        <Plus className="size-4" aria-hidden />
        <span aria-live="polite">{label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-neon-cyan/40 bg-neon-cyan/10 px-2 py-1 text-micro font-semibold text-neon-cyan-bright shadow-[0_0_18px_rgba(53,217,255,0.25)] backdrop-blur-sm transition hover:border-neon-cyan hover:bg-neon-cyan/20",
        className
      )}
    >
      <Plus className="size-3.5 shrink-0" aria-hidden />
      {/* `sr-only sm:not-sr-only`: UM único nó de texto, sempre no cálculo do
          nome acessível (nunca fica sem nome no recorte "só ícone" abaixo de
          `sm`) e visível a partir de `sm` — evita duplicar o rótulo em dois
          nós (um sempre-presente + um só-visível), que faria o leitor de
          tela anunciar o texto duas vezes a partir de `sm`. */}
      <span aria-live="polite" className="sr-only sm:not-sr-only">
        {label}
      </span>
    </button>
  );
}
