"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { PublicHeroSlide } from "@/server/lib/hero-slides";
import { externalProps, type Cta } from "@/shared/lib/nav";

type CarouselCopy = {
  prev: string;
  next: string;
  of: string;
  /** "Explore" CTA fallback (do dicionário original `home.hero`). */
  primaryCtaFallback: Cta;
  /** Logo + brand fallback. */
  brand: string;
  logoSrc: string;
  posterFallbackSrc: string;
  sceneAltFallback: string;
  scrollCue: string;
};

type HeroSliderProps = {
  slides: PublicHeroSlide[];
  copy: CarouselCopy;
};

const DEFAULT_AUTO_ADVANCE_SECONDS = 8;
const CROSSFADE_MS = 600;

/**
 * Carrossel do hero da home. Lê os slides ativos do banco (via
 * `getCachedActiveHeroSlides`) e renderiza um por vez. O auto-advance é
 * POR-SLIDE — `autoAdvanceSeconds` (ou o default 8s se NULL) define o
 * intervalo; `null` ou 0 = sem rotação.
 *
 * Mídia por slide:
 *  - `kind === "youtube"`: iframe `youtube-nocookie` com overscan de 35%
 *    (mesmo fix da rodada 5 que escondia o chrome do player — manter
 *    aqui até o MP4 self-hosted cobrir todos os slides).
 *  - `kind === "upload"`: tag `<video>` nativa, `loop`, `muted`, `playsinline`,
 *    `autoplay`; com poster opcional. Se `loopWindowStart`/`End` estiverem
 *    setados, um listener `timeupdate` clampa o tempo entre eles a cada
 *    ciclo.
 *
 * Pausa no hover. Crossfade CSS entre slides (opacity 0→1, 600ms).
 */
export function HeroSlider({ slides, copy }: HeroSliderProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const advance = useCallback(() => {
    setIndex((current) => (current + 1) % slides.length);
  }, [slides.length]);

  // Auto-advance: usa o `autoAdvanceSeconds` do PRÓXIMO slide (assim cada
  // slide controla quanto tempo fica no ar). Fallback 8s.
  useEffect(() => {
    if (slides.length <= 1 || paused) return;
    const next = slides[(index + 1) % slides.length];
    const seconds = next?.autoAdvanceSeconds ?? DEFAULT_AUTO_ADVANCE_SECONDS;
    if (!seconds || seconds <= 0) return;
    advanceTimer.current = setTimeout(advance, seconds * 1000);
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, [index, slides, paused, advance]);

  // Pausa o auto-advance quando a aba está oculta — economia de bateria.
  useEffect(() => {
    function onVisibilityChange() {
      if (document.hidden && advanceTimer.current) {
        clearTimeout(advanceTimer.current);
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  if (slides.length === 0) {
    return <HeroFallback copy={copy} />;
  }

  const current = slides[index] ?? slides[0];

  const primaryCta: Cta =
    current.primaryCta ?? copy.primaryCtaFallback;
  const secondaryCta: Cta | null = current.secondaryCta
    ? current.secondaryCta
    : null;

  return (
    <section
      className="relative min-h-[100svh] w-full overflow-hidden bg-[#05070b]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label={current.headline}
    >
      <AnimatePresence mode="sync">
        <motion.div
          key={current.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: CROSSFADE_MS / 1000, ease: "easeOut" }}
          className="absolute inset-0"
        >
          <SlideBackground slide={current} fallbackPosterSrc={copy.posterFallbackSrc} />
          <div className="absolute inset-0 bg-gradient-to-b from-[#05070b]/70 via-[#05070b]/35 to-[#05070b]" />
        </motion.div>
      </AnimatePresence>

      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-4xl flex-col items-center justify-center gap-5 px-6 pb-20 pt-24 text-center md:gap-6">
        {current.eyebrow ? (
          <p className="text-glow-cyan text-meta font-semibold uppercase tracking-[0.2em] text-neon-cyan-bright">
            {current.eyebrow}
          </p>
        ) : null}
        <h1 className="flex flex-col items-center gap-3">
          {current.kind === "upload" ? null : (
            <Image
              src={copy.logoSrc}
              alt={copy.brand}
              width={300}
              height={122}
              priority
              className="h-16 w-auto drop-shadow-[0_0_28px_rgba(53,217,255,0.35)] md:h-24"
            />
          )}
          <span className="sr-only">{current.headline}</span>
        </h1>
        <p className="max-w-2xl text-balance text-lede text-white/85">
          {current.description ?? ""}
        </p>
        <div className="mt-3 flex w-full max-w-xs flex-col gap-4 sm:w-auto sm:max-w-none sm:flex-row sm:gap-5">
          <Link href={primaryCta.href} {...externalProps(primaryCta.href)} className="btn-neon">
            {primaryCta.label}
            <span aria-hidden>→</span>
          </Link>
          {secondaryCta ? (
            <Link
              href={secondaryCta.href}
              {...externalProps(secondaryCta.href)}
              className="btn-neon btn-neon--amber"
            >
              {secondaryCta.label}
            </Link>
          ) : null}
        </div>
      </div>

      {slides.length > 1 ? (
        <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2">
          <button
            type="button"
            onClick={() => setIndex((current) => (current - 1 + slides.length) % slides.length)}
            aria-label={copy.prev}
            className="rounded-full bg-white/10 px-3 py-1 text-micro text-white/80 hover:bg-white/20"
          >
            ‹
          </button>
          <ol className="flex items-center gap-2" aria-label={`1 ${copy.of} ${slides.length}`}>
            {slides.map((slide, i) => (
              <li key={slide.id}>
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`${i + 1} ${copy.of} ${slides.length}`}
                  className={`h-2.5 w-2.5 rounded-full transition ${i === index ? "bg-neon-cyan-bright" : "bg-white/30 hover:bg-white/60"}`}
                />
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={advance}
            aria-label={copy.next}
            className="rounded-full bg-white/10 px-3 py-1 text-micro text-white/80 hover:bg-white/20"
          >
            ›
          </button>
        </div>
      ) : null}
    </section>
  );
}

function SlideBackground({
  slide,
  fallbackPosterSrc,
}: {
  slide: PublicHeroSlide;
  fallbackPosterSrc: string;
}) {
  if (slide.kind === "youtube" && slide.youtubeId) {
    return (
      <iframe
        key={`yt-${slide.youtubeId}`}
        src={`https://www.youtube-nocookie.com/embed/${slide.youtubeId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${slide.youtubeId}&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1`}
        title={slide.headline}
        tabIndex={-1}
        allow="autoplay; encrypted-media"
        className="pointer-events-none absolute left-1/2 top-1/2 aspect-video -translate-x-1/2 -translate-y-1/2 border-0"
        style={{ width: "calc(max(100vw, 100svh * 16 / 9) * 1.35)" }}
      />
    );
  }

  if (slide.kind === "upload" && slide.videoUrl) {
    return (
      <LoopWindowedVideo
        key={slide.id}
        src={slide.videoUrl}
        posterUrl={slide.posterUrl ?? fallbackPosterSrc}
        muted={slide.muted}
        loopWindow={slide.loopWindow}
      />
    );
  }

  // Fallback: pôster estático.
  return (
    <Image
      src={slide.posterUrl ?? fallbackPosterSrc}
      alt=""
      fill
      priority
      sizes="100vw"
      className="object-cover opacity-50"
    />
  );
}

function LoopWindowedVideo({
  src,
  posterUrl,
  muted,
  loopWindow,
}: {
  src: string;
  posterUrl: string;
  muted: boolean;
  loopWindow: { startSeconds: number; endSeconds: number } | null;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !loopWindow) return;
    const start = loopWindow.startSeconds;
    const end = loopWindow.endSeconds;
    if (end <= start) return;
    function onTimeUpdate() {
      if (!el) return;
      if (el.currentTime < start || el.currentTime > end) {
        el.currentTime = start;
      }
    }
    el.addEventListener("timeupdate", onTimeUpdate);
    return () => el.removeEventListener("timeupdate", onTimeUpdate);
  }, [loopWindow]);

  return (
    <video
      ref={ref}
      src={src}
      poster={posterUrl}
      autoPlay
      loop={!loopWindow}
      muted={muted}
      playsInline
      preload="metadata"
      className="pointer-events-none absolute left-1/2 top-1/2 aspect-video min-h-full min-w-full -translate-x-1/2 -translate-y-1/2 object-cover"
    />
  );
}

function HeroFallback({ copy }: { copy: CarouselCopy }) {
  return (
    <section className="relative min-h-[100svh] w-full overflow-hidden bg-[#05070b]">
      <Image
        src={copy.posterFallbackSrc}
        alt={copy.sceneAltFallback}
        fill
        priority
        sizes="100vw"
        className="object-cover opacity-50"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#05070b]/70 via-[#05070b]/35 to-[#05070b]" />
      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-4xl flex-col items-center justify-center gap-5 px-6 pb-20 pt-24 text-center md:gap-6">
        <Image
          src={copy.logoSrc}
          alt={copy.brand}
          width={300}
          height={122}
          priority
          className="h-16 w-auto drop-shadow-[0_0_28px_rgba(53,217,255,0.35)] md:h-24"
        />
        <Link href={copy.primaryCtaFallback.href} className="btn-neon">
          {copy.primaryCtaFallback.label}
        </Link>
      </div>
    </section>
  );
}
