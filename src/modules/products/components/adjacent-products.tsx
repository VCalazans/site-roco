import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Package } from "lucide-react";
import { cn } from "@/core/lib/utils";
import type { Locale } from "@/i18n/config";
import type { PublicProductItem } from "@/modules/products/lib/types";

type AdjacentProductsProps = {
  previous: PublicProductItem | null;
  next: PublicProductItem | null;
  locale: Locale;
  labels: { previousProduct: string; nextProduct: string; adjacentLabel: string };
};

/**
 * Produto anterior / próximo da MESMA categoria, na ordem da listagem (spec
 * 001, RF13) — navegar o catálogo sem voltar à grade. Cada lado mostra a
 * foto e o nome do destino, para a seta nunca ser um salto no escuro.
 */
export function AdjacentProducts({ previous, next, locale, labels }: AdjacentProductsProps) {
  if (!previous && !next) return null;

  return (
    <nav aria-label={labels.adjacentLabel} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {previous ? (
        <AdjacentLink product={previous} locale={locale} direction="prev" caption={labels.previousProduct} />
      ) : (
        <span className="hidden sm:block" />
      )}
      {next ? <AdjacentLink product={next} locale={locale} direction="next" caption={labels.nextProduct} /> : null}
    </nav>
  );
}

function AdjacentLink({
  product,
  locale,
  direction,
  caption,
}: {
  product: PublicProductItem;
  locale: Locale;
  direction: "prev" | "next";
  caption: string;
}) {
  const name = locale === "en" && product.nameEn ? product.nameEn : product.namePt;
  const cover = product.images[0];
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;

  return (
    <Link
      href={`/${locale}/produtos/${product.slug}`}
      rel={direction}
      className={cn(
        "group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-neon-cyan/50 hover:bg-white/[0.05]",
        direction === "next" && "sm:flex-row-reverse sm:text-right"
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/80 transition group-hover:border-neon-cyan-bright group-hover:text-neon-cyan-bright">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-[#0a0f16]">
        {cover ? (
          <Image src={cover.url} alt="" fill sizes="56px" className="object-contain p-1.5" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-white/20">
            <Package className="size-6" aria-hidden />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-micro font-semibold uppercase tracking-[0.12em] text-white/50">{caption}</span>
        <span className="mt-0.5 line-clamp-2 block text-meta font-semibold text-white transition group-hover:text-neon-cyan-bright">
          {name}
        </span>
      </span>
    </Link>
  );
}
