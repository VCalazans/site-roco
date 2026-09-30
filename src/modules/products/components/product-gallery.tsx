"use client";

import { useRef, useState, ViewTransition, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Package } from "lucide-react";
import { cn } from "@/core/lib/utils";
import { interpolate } from "@/shared/lib/interpolate";

export type GalleryImage = { url: string; alt: string };

export type ProductGalleryLabels = {
  label: string;
  prev: string;
  next: string;
  /** "Ver imagem {index} de {total}". */
  thumb: string;
};

type ProductGalleryProps = {
  images: GalleryImage[];
  labels: ProductGalleryLabels;
  /** Nome da View Transition compartilhada com a foto do card (morph). */
  transitionName: string;
  /** Selo sobreposto no canto da foto principal (ex.: campeão de vendas). */
  overlay?: ReactNode;
};

const SWIPE_THRESHOLD_PX = 40;

/**
 * Galeria do detalhe do produto (spec 001, RF13). Antes as miniaturas eram
 * estáticas (clicar não fazia nada) e só as 5 primeiras fotos apareciam.
 * Agora: setas sobre a foto principal, miniaturas clicáveis com a atual
 * destacada, ←/→ com o foco na galeria e arraste no toque. A foto principal
 * é o par da foto do card na transição "morph" entre as páginas.
 */
export function ProductGallery({ images, labels, transitionName, overlay }: ProductGalleryProps) {
  const [index, setIndex] = useState(0);
  const pointerStart = useRef<number | null>(null);
  const total = images.length;
  const current = images[index] ?? images[0];

  const go = (next: number) => setIndex(((next % total) + total) % total);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (total <= 1) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      go(index + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(index - 1);
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") pointerStart.current = event.clientX;
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (start === null || total <= 1) return;
    const dx = event.clientX - start;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
    go(dx < 0 ? index + 1 : index - 1);
  }

  return (
    <div
      role="region"
      aria-label={labels.label}
      aria-roledescription="carousel"
      tabIndex={total > 1 ? 0 : -1}
      onKeyDown={handleKeyDown}
      className="outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/40 focus-visible:ring-offset-4 focus-visible:ring-offset-[#05070b] rounded-3xl"
    >
      <div
        className="relative aspect-square w-full overflow-hidden rounded-3xl border border-white/10 bg-[#0a0f16] shadow-[0_0_60px_-20px_rgba(53,217,255,0.35)]"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        {current ? (
          <ViewTransition name={transitionName} share="product-morph" default="none">
            <div className="absolute inset-0">
              <Image
                key={current.url}
                src={current.url}
                alt={current.alt}
                fill
                priority
                sizes="(min-width: 1024px) 45vw, 90vw"
                className="object-contain p-8"
              />
            </div>
          </ViewTransition>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/15">
            <Package className="size-24" aria-hidden />
          </div>
        )}

        {overlay ? <div className="pointer-events-none absolute left-4 top-4 z-10">{overlay}</div> : null}

        {total > 1 ? (
          <>
            <GalleryArrow direction="prev" label={labels.prev} onClick={() => go(index - 1)} />
            <GalleryArrow direction="next" label={labels.next} onClick={() => go(index + 1)} />
            <span className="absolute bottom-3 right-4 rounded-full bg-black/50 px-2.5 py-1 text-micro tabular-nums text-white/80 backdrop-blur-sm">
              {index + 1} / {total}
            </span>
          </>
        ) : null}
      </div>

      {total > 1 ? (
        <ul className="mt-4 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {images.map((image, imageIndex) => (
            <li key={`${image.url}-${imageIndex}`} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(imageIndex)}
                aria-label={interpolate(labels.thumb, { index: imageIndex + 1, total })}
                aria-current={imageIndex === index ? "true" : undefined}
                className={cn(
                  "relative block size-20 overflow-hidden rounded-xl border bg-[#0a0f16] transition sm:size-24",
                  imageIndex === index
                    ? "border-neon-cyan-bright shadow-[0_0_16px_rgba(53,217,255,0.35)]"
                    : "border-white/10 opacity-70 hover:border-white/30 hover:opacity-100"
                )}
              >
                <Image src={image.url} alt="" fill sizes="96px" className="object-contain p-2" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function GalleryArrow({ direction, label, onClick }: { direction: "prev" | "next"; label: string; onClick: () => void }) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "absolute top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-[#05070b]/70 text-white backdrop-blur-sm transition hover:border-neon-cyan-bright hover:text-neon-cyan-bright",
        direction === "prev" ? "left-3" : "right-3"
      )}
    >
      <Icon className="size-5" aria-hidden />
    </button>
  );
}
