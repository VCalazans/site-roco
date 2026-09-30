"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { cn } from "@/core/lib/utils";
import type { PublicHeroSlide } from "@/server/lib/hero-slides";
import { interpolate } from "@/shared/lib/interpolate";
import { externalProps, type Cta } from "@/shared/lib/nav";

/** `dictionary.home.hero.carousel` — todos os rótulos do carrossel. */
export type HeroCarouselLabels = {
  prev: string;
  next: string;
  goTo: string;
  slideLabel: string;
  pause: string;
  play: string;
  roleDescription: string;
  slideRoleDescription: string;
};

type HeroCopy = {
  carousel: HeroCarouselLabels;
  /** "Explore" CTA fallback (do dicionário original `home.hero`). */
  primaryCtaFallback: Cta;
  /** Slide de reserva (banco sem slides ativos) montado com a copy do dicionário. */
  fallbackSlide: {
    eyebrow: string;
    headline: string;
    description: string;
    secondaryCta: Cta;
  };
  brand: string;
  /** Logo 3D oficial — peça central quando o slide não traz mídia própria. */
  logoSrc: string;
  logoWidth: number;
  logoHeight: number;
  scrollCue: string;
};

type HeroSliderProps = {
  slides: PublicHeroSlide[];
  copy: HeroCopy;
};

const DEFAULT_AUTO_ADVANCE_SECONDS = 8;
const CROSSFADE_S = 0.7;
/** Arraste mínimo (px) para um gesto de toque virar troca de slide. */
const SWIPE_THRESHOLD_PX = 50;

/**
 * Carrossel do hero da home, no padrão WEG (spec 001, RF11): setas grandes nas
 * laterais, indicadores com progresso do tempo de cada slide, pausa/retomada
 * (WCAG 2.2.2 — conteúdo que se move sozinho por mais de 5 s precisa de
 * controle de pausa), teclado (←/→ com o foco dentro do carrossel) e gesto de
 * arraste no toque.
 *
 * O auto-advance é POR SLIDE (`autoAdvanceSeconds` do slide ATUAL; 8 s se
 * nulo; 0 = sem rotação) e pausa sozinho no hover, com o foco dentro, com a
 * aba oculta e para quem pede movimento reduzido.
 *
 * Mídia por slide: `youtube` (iframe `youtube-nocookie` com overscan para
 * esconder o chrome do player), `upload` (`<video>` nativo, com janela de
 * loop opcional) ou pôster estático.
 */
export function HeroSlider({ slides, copy }: HeroSliderProps) {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [focusPaused, setFocusPaused] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);

  const count = slides.length;
  const goTo = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);
  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  const current = slides[index] ?? slides[0];
  const seconds = current?.autoAdvanceSeconds ?? DEFAULT_AUTO_ADVANCE_SECONDS;
  const rotates = count > 1 && seconds > 0;
  const playing = rotates && !userPaused && !hoverPaused && !focusPaused && !tabHidden && !reduceMotion;

  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(next, seconds * 1000);
    return () => clearTimeout(timer);
  }, [playing, next, seconds, index]);

  useEffect(() => {
    const onVisibility = () => setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  if (count === 0 || !current) {
    return <HeroFallback copy={copy} />;
  }

  const primaryCta: Cta = current.primaryCta ?? copy.primaryCtaFallback;
  const secondaryCta: Cta | null = current.secondaryCta ?? null;
  const showLogo = current.kind !== "upload";

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (count <= 1) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      next();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      prev();
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    if (event.pointerType !== "touch") return;
    pointerStart.current = { x: event.clientX, y: event.clientY };
  }

  function handlePointerUp(event: PointerEvent<HTMLElement>) {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start || count <= 1) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    // Só gesto predominantemente HORIZONTAL troca de slide — rolagem vertical
    // da página no toque nunca pode virar troca acidental.
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) next();
    else prev();
  }

  function scrollPastHero() {
    const height = sectionRef.current?.offsetHeight ?? window.innerHeight;
    window.scrollTo({ top: height, behavior: reduceMotion ? "auto" : "smooth" });
  }

  const slideLabel = interpolate(copy.carousel.slideLabel, { index: index + 1, total: count });

  return (
    <section
      ref={sectionRef}
      className="relative min-h-[100svh] w-full overflow-hidden bg-[#05070b]"
      onMouseEnter={() => setHoverPaused(true)}
      onMouseLeave={() => setHoverPaused(false)}
      onFocusCapture={() => setFocusPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusPaused(false);
      }}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      aria-roledescription={copy.carousel.roleDescription}
      aria-label={copy.brand}
    >
      <AnimatePresence mode="sync" initial={false}>
        <motion.div
          key={current.id}
          initial={{ opacity: 0, scale: reduceMotion ? 1 : 1.03 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : CROSSFADE_S, ease: "easeOut" }}
          className="absolute inset-0"
          aria-hidden
        >
          <SlideBackground slide={current} />
          <div className="absolute inset-0 bg-gradient-to-b from-[#05070b]/75 via-[#05070b]/30 to-[#05070b]" />
          <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_45%,transparent,rgba(5,7,11,0.55))]" />
        </motion.div>
      </AnimatePresence>

      {/* Conteúdo do slide atual. `aria-live` só quando PARADO: um carrossel
          que troca sozinho não pode ficar anunciando cada slide. */}
      <div
        role="group"
        aria-roledescription={copy.carousel.slideRoleDescription}
        aria-label={slideLabel}
        aria-live={playing ? "off" : "polite"}
        className="relative z-10 mx-auto flex min-h-[100svh] max-w-4xl flex-col items-center justify-center gap-5 px-6 pb-32 pt-28 text-center md:gap-6 md:px-24 md:pb-28"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: reduceMotion ? 0 : 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
            transition={{ duration: reduceMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center gap-5 md:gap-6"
          >
            {current.eyebrow ? (
              <p className="text-glow-cyan text-meta font-semibold uppercase tracking-[0.2em] text-neon-cyan-bright">
                {current.eyebrow}
              </p>
            ) : null}
            <h1 className="flex flex-col items-center gap-3">
              {showLogo ? (
                <Image
                  src={copy.logoSrc}
                  alt={copy.brand}
                  width={copy.logoWidth}
                  height={copy.logoHeight}
                  priority
                  sizes="(min-width: 768px) 420px, 280px"
                  className="h-auto w-[min(70vw,280px)] drop-shadow-[0_18px_40px_rgba(0,0,0,0.55)] md:w-[420px]"
                />
              ) : null}
              <span className="sr-only">{current.headline}</span>
            </h1>
            {current.description ? (
              <p className="max-w-2xl text-balance text-lede text-white/85">{current.description}</p>
            ) : null}
            <div className="mt-2 flex w-full max-w-xs flex-col gap-4 sm:w-auto sm:max-w-none sm:flex-row sm:gap-5">
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
          </motion.div>
        </AnimatePresence>
      </div>

      {count > 1 ? (
        <>
          {/* Setas laterais (WEG): alvo de 48–56px, sempre legíveis sobre vídeo. */}
          <HeroArrow direction="prev" label={copy.carousel.prev} onClick={prev} />
          <HeroArrow direction="next" label={copy.carousel.next} onClick={next} />

          <div className="absolute bottom-20 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 md:bottom-24">
            {/* No celular as setas moram aqui, na barra de controles — nas
                laterais elas roubariam 2 × 64px da largura do texto. */}
            <MobileArrow direction="prev" label={copy.carousel.prev} onClick={prev} />
            <ol className="flex items-center gap-2">
              {slides.map((slide, slideIndex) => {
                const active = slideIndex === index;
                return (
                  <li key={slide.id}>
                    <button
                      type="button"
                      onClick={() => goTo(slideIndex)}
                      aria-label={interpolate(copy.carousel.goTo, { index: slideIndex + 1, total: count })}
                      aria-current={active ? "true" : undefined}
                      className="group flex h-6 items-center"
                    >
                      <span
                        className={cn(
                          "relative block h-1 overflow-hidden rounded-full bg-white/25 transition-all duration-300 group-hover:bg-white/50",
                          active ? "w-12" : "w-6"
                        )}
                      >
                        {active && playing ? (
                          <span
                            // Tocando: a barra enche no tempo do slide (reinicia
                            // a cada troca via `key`, junto com o timer).
                            key={current.id}
                            className="hero-progress absolute inset-y-0 left-0 rounded-full bg-neon-cyan-bright"
                            style={{ animationDuration: `${seconds}s` }}
                          />
                        ) : active ? (
                          // Parado (pausa, hover, foco, sem rotação): indicador cheio.
                          <span className="absolute inset-0 rounded-full bg-neon-cyan-bright" />
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            {rotates ? (
              <button
                type="button"
                onClick={() => setUserPaused((value) => !value)}
                aria-label={userPaused ? copy.carousel.play : copy.carousel.pause}
                title={userPaused ? copy.carousel.play : copy.carousel.pause}
                className="flex size-8 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white/80 backdrop-blur-sm transition hover:border-white/50 hover:text-white"
              >
                {userPaused ? <Play className="size-3.5" aria-hidden /> : <Pause className="size-3.5" aria-hidden />}
              </button>
            ) : null}
            <MobileArrow direction="next" label={copy.carousel.next} onClick={next} />
          </div>
        </>
      ) : null}

      <ScrollCue label={copy.scrollCue} onClick={scrollPastHero} />
    </section>
  );
}

function HeroArrow({
  direction,
  label,
  onClick,
}: {
  direction: "prev" | "next";
  label: string;
  onClick: () => void;
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "absolute top-1/2 z-20 hidden size-14 -translate-y-1/2 items-center justify-center rounded-full border border-white/35 bg-black/25 text-white backdrop-blur-sm transition hover:border-neon-cyan-bright hover:text-neon-cyan-bright hover:shadow-[0_0_24px_rgba(53,217,255,0.45)] md:flex",
        direction === "prev" ? "left-8" : "right-8"
      )}
    >
      <Icon className="size-7" strokeWidth={1.5} aria-hidden />
    </button>
  );
}

/** Seta compacta da barra de controles — só abaixo de `md`. */
function MobileArrow({
  direction,
  label,
  onClick,
}: {
  direction: "prev" | "next";
  label: string;
  onClick: () => void;
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex size-9 items-center justify-center rounded-full border border-white/25 bg-black/30 text-white backdrop-blur-sm transition hover:border-neon-cyan-bright hover:text-neon-cyan-bright md:hidden"
    >
      <Icon className="size-5" strokeWidth={1.75} aria-hidden />
    </button>
  );
}

function ScrollCue({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="absolute bottom-6 left-1/2 z-20 flex size-10 -translate-x-1/2 items-center justify-center rounded-full text-white/70 transition hover:text-white"
    >
      <ChevronDown className="hero-scroll-cue size-7" strokeWidth={1.5} aria-hidden />
    </button>
  );
}

/**
 * Fundo de marca sob a mídia (brilhos ciano/âmbar sobre o navy): é o que se vê
 * enquanto o vídeo carrega ou se o autoplay for bloqueado. Substitui o pôster
 * `hero-stage.jpg` como padrão — aquele render tem logo e BOTÕES "assados" na
 * imagem, que apareciam duplicados atrás dos botões reais do slide.
 */
function HeroBackdrop() {
  return (
    <div className="absolute inset-0 bg-[#05070b]">
      <div className="absolute -left-40 top-1/4 size-[40rem] rounded-full bg-neon-cyan/15 blur-[160px]" />
      <div className="absolute -right-40 bottom-0 size-[36rem] rounded-full bg-neon-amber/10 blur-[160px]" />
    </div>
  );
}

function SlideBackground({ slide }: { slide: PublicHeroSlide }) {
  if (slide.kind === "youtube" && slide.youtubeId) {
    return (
      <>
        <HeroBackdrop />
        {slide.posterUrl ? (
          <Image src={slide.posterUrl} alt="" fill priority sizes="100vw" className="object-cover opacity-60" />
        ) : null}
        <iframe
          key={`yt-${slide.youtubeId}`}
          src={`https://www.youtube-nocookie.com/embed/${slide.youtubeId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${slide.youtubeId}&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1`}
          title={slide.headline}
          tabIndex={-1}
          allow="autoplay; encrypted-media"
          className="pointer-events-none absolute left-1/2 top-1/2 aspect-video -translate-x-1/2 -translate-y-1/2 border-0"
          style={{ width: "calc(max(100vw, 100svh * 16 / 9) * 1.35)" }}
        />
      </>
    );
  }

  if (slide.kind === "upload" && slide.videoUrl) {
    return (
      <>
        <HeroBackdrop />
        <LoopWindowedVideo
          key={slide.id}
          src={slide.videoUrl}
          posterUrl={slide.posterUrl}
          muted={slide.muted}
          loopWindow={slide.loopWindow}
        />
      </>
    );
  }

  return (
    <>
      <HeroBackdrop />
      {slide.posterUrl ? (
        <Image src={slide.posterUrl} alt="" fill priority sizes="100vw" className="object-cover opacity-60" />
      ) : null}
    </>
  );
}

function LoopWindowedVideo({
  src,
  posterUrl,
  muted,
  loopWindow,
}: {
  src: string;
  posterUrl: string | null;
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
      poster={posterUrl ?? undefined}
      autoPlay
      loop={!loopWindow}
      muted={muted}
      playsInline
      preload="metadata"
      className="pointer-events-none absolute left-1/2 top-1/2 aspect-video min-h-full min-w-full -translate-x-1/2 -translate-y-1/2 object-cover"
    />
  );
}

/**
 * Banco sem nenhum slide ativo (dev sem seed, ou o marketing despublicou
 * tudo): um "slide" completo com a copy padrão do dicionário (`home.hero`),
 * no mesmo desenho dos slides reais — a primeira dobra nunca fica vazia.
 */
function HeroFallback({ copy }: { copy: HeroCopy }) {
  const { fallbackSlide } = copy;
  return (
    <section className="relative min-h-[100svh] w-full overflow-hidden bg-[#05070b]">
      <HeroBackdrop />
      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-4xl flex-col items-center justify-center gap-5 px-6 pb-24 pt-28 text-center md:gap-6">
        {fallbackSlide.eyebrow ? (
          <p className="text-glow-cyan text-meta font-semibold uppercase tracking-[0.2em] text-neon-cyan-bright">
            {fallbackSlide.eyebrow}
          </p>
        ) : null}
        <h1 className="flex flex-col items-center gap-3">
          <Image
            src={copy.logoSrc}
            alt={copy.brand}
            width={copy.logoWidth}
            height={copy.logoHeight}
            priority
            sizes="(min-width: 768px) 420px, 280px"
            className="h-auto w-[min(70vw,280px)] drop-shadow-[0_18px_40px_rgba(0,0,0,0.55)] md:w-[420px]"
          />
          <span className="sr-only">{fallbackSlide.headline}</span>
        </h1>
        {fallbackSlide.description ? (
          <p className="max-w-2xl text-balance text-lede text-white/85">{fallbackSlide.description}</p>
        ) : null}
        <div className="mt-2 flex w-full max-w-xs flex-col gap-4 sm:w-auto sm:max-w-none sm:flex-row sm:gap-5">
          <Link href={copy.primaryCtaFallback.href} {...externalProps(copy.primaryCtaFallback.href)} className="btn-neon">
            {copy.primaryCtaFallback.label}
            <span aria-hidden>→</span>
          </Link>
          <Link
            href={fallbackSlide.secondaryCta.href}
            {...externalProps(fallbackSlide.secondaryCta.href)}
            className="btn-neon btn-neon--amber"
          >
            {fallbackSlide.secondaryCta.label}
          </Link>
        </div>
      </div>
    </section>
  );
}
