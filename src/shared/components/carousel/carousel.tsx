"use client";

import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/core/lib/utils";

type CarouselProps = {
  children: ReactNode;
  /** Rótulos das setas — vêm do dicionário (`*.carousel.prev/next`). */
  labels: { prev: string; next: string };
  /** Nome da região para leitor de tela (título da seção). */
  ariaLabel: string;
  /** Largura de CADA item por breakpoint (ex.: `w-[78%] sm:w-[46%] lg:w-[calc(25%-12px)]`). */
  itemClassName: string;
  /** Espaço entre itens — precisa casar com o `calc` de `itemClassName`. */
  gapClassName?: string;
  className?: string;
};

/**
 * Carrossel horizontal com setas (spec 001, RF12) — trilho com scroll-snap
 * nativo (arraste no toque e rolagem de trackpad funcionam sem JS) e setas
 * que avançam UMA "página" visível por clique. As setas se desabilitam nas
 * pontas e somem quando tudo cabe na tela (ex.: as 6 categorias no desktop),
 * então o mesmo componente serve para vitrine que transborda e que não.
 *
 * Acessível: o trilho é uma região rotulada e focável (setas do teclado
 * rolam o conteúdo nativamente); cada item continua sendo o seu próprio link.
 */
export function Carousel({
  children,
  labels,
  ariaLabel,
  itemClassName,
  gapClassName = "gap-4",
  className,
}: CarouselProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const update = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    // Tolerância de 2px: arredondamento subpixel do scroll-snap nunca deixa a
    // seta "quase" habilitada na ponta.
    setCanPrev(track.scrollLeft > 2);
    setCanNext(track.scrollLeft + track.clientWidth < track.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    update();
    const observer = new ResizeObserver(update);
    observer.observe(track);
    return () => observer.disconnect();
  }, [update]);

  function scrollByPage(direction: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollBy({ left: direction * track.clientWidth * 0.9, behavior: reduceMotion ? "auto" : "smooth" });
  }

  const hasOverflow = canPrev || canNext;

  return (
    <div className={cn("relative", className)}>
      <div
        ref={trackRef}
        onScroll={update}
        role="region"
        aria-label={ariaLabel}
        tabIndex={0}
        className={cn(
          "flex snap-x snap-mandatory overflow-x-auto scroll-smooth pb-4 outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-neon-cyan/40 [&::-webkit-scrollbar]:hidden",
          gapClassName
        )}
      >
        {Children.map(children, (child) => (
          <div className={cn("shrink-0 snap-start", itemClassName)}>{child}</div>
        ))}
      </div>

      {hasOverflow ? (
        <>
          <CarouselArrow direction="prev" label={labels.prev} disabled={!canPrev} onClick={() => scrollByPage(-1)} />
          <CarouselArrow direction="next" label={labels.next} disabled={!canNext} onClick={() => scrollByPage(1)} />
        </>
      ) : null}
    </div>
  );
}

function CarouselArrow({
  direction,
  label,
  disabled,
  onClick,
}: {
  direction: "prev" | "next";
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "absolute top-[calc(50%-0.5rem)] z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-[#05070b]/85 text-white shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-md transition hover:border-neon-cyan-bright hover:text-neon-cyan-bright hover:shadow-[0_0_24px_rgba(53,217,255,0.35)] disabled:pointer-events-none disabled:opacity-0",
        direction === "prev" ? "-left-2 sm:-left-5" : "-right-2 sm:-right-5"
      )}
    >
      <Icon className="size-5" aria-hidden />
    </button>
  );
}
