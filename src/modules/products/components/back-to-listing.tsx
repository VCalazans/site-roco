"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { recallListingUrl } from "@/modules/products/lib/listing-memory";

type BackToListingProps = {
  locale: string;
  /** Destino padrão (listagem sem filtros) — é o `href` real do link. */
  fallbackHref: string;
  label: string;
};

/**
 * "Voltar aos produtos" (spec 001, RF13): devolve a pessoa à listagem COMO
 * ELA ESTAVA (busca, categoria, campeões, página) — lida do `sessionStorage`
 * no clique. O `href` do link continua sendo a listagem limpa: é o que o
 * servidor renderiza, o que "abrir em nova aba" usa e o destino quando não há
 * memória (visitante chegou direto no produto por um link externo).
 */
export function BackToListing({ locale, fallbackHref, label }: BackToListingProps) {
  const router = useRouter();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    // Clique com modificador (nova aba/janela) segue o href padrão.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    const remembered = recallListingUrl(locale, fallbackHref);
    if (remembered === fallbackHref) return;
    event.preventDefault();
    router.push(remembered);
  }

  return (
    <Link
      href={fallbackHref}
      onClick={handleClick}
      className="inline-flex w-fit shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-white/15 bg-white/5 py-2 pl-3 pr-4 text-meta font-semibold text-white/85 transition hover:border-neon-cyan/50 hover:text-white"
    >
      <ArrowLeft className="size-4" aria-hidden />
      {label}
    </Link>
  );
}
