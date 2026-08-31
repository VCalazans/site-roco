"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { cn } from "@/core/lib/utils";
import { cartPath } from "@/core/config/site";
import { useCartCount } from "@/shared/lib/cart-store";
import type { Locale } from "@/i18n/config";

type CartNavLinkProps = {
  locale: Locale;
  /** Nome acessível do link — `dictionary.cart.nav.label`, NUNCA hardcode.
   *  Fixo (não embute a contagem): a contagem só existe no client, e um
   *  `aria-label` que variasse entre o HTML do servidor e o primeiro paint
   *  do cliente reabriria a mesma classe de mismatch de hidratação já
   *  documentada em vários pontos deste projeto (ver `ConsentBanner`). */
  label: string;
  className?: string;
};

const MAX_BADGE_COUNT = 99;

/**
 * Ícone do carrinho de cotação — mesmo tratamento visual do
 * `PortalLoginLink` (`size-10`, `rounded-full`, borda translúcida), SEMPRE
 * visível (mobile e desktop, dentro E fora do painel do hambúrguer).
 *
 * A contagem nasce em 0 no HTML do servidor (`useCartCount`'s
 * `getServerSnapshot` — ver `@/shared/lib/cart-store`) e reconcilia no
 * primeiro paint do cliente, o mesmo idioma visual do `ConsentBanner`: sem
 * isso o servidor precisaria adivinhar o `localStorage` de quem pediu a
 * página, o que é impossível.
 */
export function CartNavLink({ locale, label, className }: CartNavLinkProps) {
  const count = useCartCount();
  const displayCount = count > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : String(count);

  return (
    <Link
      href={cartPath(locale)}
      aria-label={label}
      title={label}
      className={cn(
        "relative flex size-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/85 transition hover:border-white/30 hover:bg-white/10 hover:text-white",
        className
      )}
    >
      <ShoppingCart className="size-[18px]" aria-hidden />

      {count > 0 ? (
        <span
          aria-hidden
          className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-neon-amber-bright px-1 text-[10px] font-bold leading-none text-background"
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
