"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { cn } from "@/core/lib/utils";
import { quotePath } from "@/core/config/site";
import { getCart, useCartCount } from "@/shared/lib/cart-store";
import type { Locale } from "@/i18n/config";

type CartNavLinkProps = {
  locale: Locale;
  /** Nome acessível do link — `dictionary.cart.nav.label` ("Meu orçamento"),
   *  NUNCA hardcode. Fixo (não embute a contagem): a contagem só existe no
   *  client, e um `aria-label` que variasse entre o HTML do servidor e o
   *  primeiro paint do cliente reabriria a mesma classe de mismatch de
   *  hidratação já documentada em vários pontos deste projeto (ver
   *  `ConsentBanner`). */
  label: string;
  className?: string;
};

const MAX_BADGE_COUNT = 99;
const BUMP_MS = 600;

/**
 * Ícone de "Meu orçamento" (antes "carrinho de cotação" — spec 001 trocou o
 * vocabulário e o ícone: prancheta com lista em vez de carrinho de compras,
 * que sugeria e-commerce com preço/checkout). Mesmo tratamento visual do
 * `PortalLoginLink` (`size-10`, `rounded-full`), SEMPRE visível.
 *
 * A contagem nasce em 0 no HTML do servidor (`getServerSnapshot` do store) e
 * reconcilia no primeiro paint do cliente. Quando ela SOBE (produto
 * adicionado em qualquer card), o badge dá um "pulso" curto — o feedback de
 * que o item foi para o orçamento acontece onde a pessoa vai procurá-lo depois.
 */
export function CartNavLink({ locale, label, className }: CartNavLinkProps) {
  const count = useCartCount();
  const displayCount = count > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : String(count);

  // Linha de base = contagem REAL do store no primeiro efeito, não o 0 do
  // snapshot de servidor: a hidratação leva a contagem de 0 para N sem que
  // ninguém tenha adicionado nada, e isso não pode "pulsar" a cada página.
  const previousCount = useRef<number | null>(null);
  const [bumping, setBumping] = useState(false);
  useEffect(() => {
    if (previousCount.current === null) {
      previousCount.current = getCart().reduce((sum, item) => sum + item.quantity, 0);
      return;
    }
    const increased = count > previousCount.current;
    previousCount.current = count;
    if (!increased) return;
    // Estado derivado de um evento externo (o store) — o "pulso" é transitório
    // por natureza, então liga aqui e desliga no timer.
    setBumping(true);
    const timer = setTimeout(() => setBumping(false), BUMP_MS);
    return () => clearTimeout(timer);
  }, [count]);

  return (
    <Link
      href={quotePath(locale)}
      aria-label={label}
      title={label}
      className={cn(
        "relative flex size-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/85 transition hover:border-white/30 hover:bg-white/10 hover:text-white",
        bumping && "border-neon-amber/70 text-neon-amber-bright",
        className
      )}
    >
      <ClipboardList className="size-[18px]" aria-hidden />

      {count > 0 ? (
        <span
          aria-hidden
          className={cn(
            "absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-neon-amber-bright px-1 text-[10px] font-bold leading-none text-background transition-transform duration-300",
            bumping && "scale-125 shadow-[0_0_14px_rgba(255,180,84,0.8)]"
          )}
        >
          {displayCount}
        </span>
      ) : null}

      {/* Anúncio para leitor de tela: só existe DEPOIS de montar (a contagem
          é 0/"" no SSR), então nunca diverge do que o servidor mandou. */}
      <span className="sr-only" aria-live="polite">
        {count > 0 ? `${label} (${count})` : ""}
      </span>
    </Link>
  );
}
