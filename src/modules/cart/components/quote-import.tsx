"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import type { CartItem } from "@/shared/lib/cart-store";
import { importItems } from "@/shared/lib/cart-store";
import { interpolate } from "@/shared/lib/interpolate";
import { QUOTE_ITEMS_PARAM } from "@/shared/lib/quote-link";

type QuoteImportProps = {
  /** Itens do link já conferidos no servidor (só produtos publicados). */
  items: CartItem[];
  /** Quantos itens do link não existem mais no catálogo público. */
  missing: number;
  copy: { added: string; missing: string };
};

/**
 * Link de orçamento pronto (montado pela IA via MCP): coloca os itens em "Meu
 * orçamento" UMA vez e tira `?itens=` da barra de endereço, para recarregar a
 * página não reaplicar o link por cima das mudanças da pessoa. Nada é enviado:
 * a pessoa revisa e envia pelo formulário de sempre.
 */
export function QuoteImport({ items, missing, copy }: QuoteImportProps) {
  const done = useRef(false);
  const [applied, setApplied] = useState<number | null>(null);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const count = items.length > 0 ? importItems(items) : 0;

    const url = new URL(window.location.href);
    url.searchParams.delete(QUOTE_ITEMS_PARAM);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);

    // Estado só depois do efeito externo (localStorage) — por isso no timeout.
    window.setTimeout(() => setApplied(count), 0);
  }, [items]);

  if (applied === null || (applied === 0 && missing === 0)) return null;

  return (
    <div
      role="status"
      className="mb-6 flex items-start gap-3 rounded-2xl border border-neon-cyan/30 bg-neon-cyan/[0.06] px-5 py-4 text-meta text-white/85"
    >
      <Sparkles className="mt-0.5 size-4 shrink-0 text-neon-cyan-bright" aria-hidden />
      <div className="flex flex-col gap-1">
        {applied > 0 ? <p>{interpolate(copy.added, { count: applied })}</p> : null}
        {missing > 0 ? <p className="text-white/65">{interpolate(copy.missing, { count: missing })}</p> : null}
      </div>
    </div>
  );
}
