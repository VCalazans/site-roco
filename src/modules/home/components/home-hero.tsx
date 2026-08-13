"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight, ChevronDown, Download } from "lucide-react";
import { SiteHeader } from "@/shared/components/nav";
import { fade } from "@/modules/home/lib/hero-layout";
import { externalProps, type Cta, type NavLink } from "@/shared/lib/nav";

type HomeHeroContent = {
  eyebrow: string;
  headline: string;
  description: string;
  primaryCta: Cta;
  secondaryCta: Cta;
  sceneAlt: string;
  scrollCue: string;
};

type HomeHeroProps = {
  brand: string;
  content: HomeHeroContent;
  navLinks: NavLink[];
  menuLabels: { open: string; close: string };
};

/**
 * Vídeo institucional da ROCO (YouTube, embed privacy-enhanced) como fundo do
 * hero — decisão de 2026-08-12 (ver decisionLog): "por hora" via
 * youtube-nocookie, até existir um MP4 self-hosted. Parâmetros: autoplay
 * mudo em loop, sem controles/teclado, `playsinline` para iOS. A CSP ganhou
 * `frame-src https://www.youtube-nocookie.com` (script-src segue 'self').
 */
const VIDEO_ID = "rqn-okkh0ww";
const VIDEO_EMBED = `https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&mute=1&controls=0&loop=1&playlist=${VIDEO_ID}&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1`;

/**
 * Pôster exibido atrás/enquanto o vídeo carrega (e quando o autoplay é
 * bloqueado): o render 3D do hero anterior, esmaecido sob o gradiente.
 */
const POSTER = "/images/hero/hero-stage.jpg";

/** Mesmo logotipo 2D limpo do `SiteHeader`/`SiteFooter` — ver comentário lá. */
const LOGO = "/images/hero/roco-logo.png";

/**
 * Hero da HOME no padrão WEG (ver `docs/referencia weg/home/image1.png`):
 * primeira dobra 100% mídia (vídeo institucional em COVER full-bleed, cortado
 * simetricamente no eixo que sobrar), conteúdo VIVO centralizado nos dois
 * eixos (eyebrow + headline + parágrafo + CTAs) e indicador de scroll no
 * rodapé. Um único layout para todos os breakpoints — o desktop deixou de
 * depender do render com botões "assados" e seus hotspots medidos do .psd
 * (`CtaHotspot`/`POS` aposentados; histórico no git), então os CTAs viraram
 * botões reais (`.btn-neon`), os mesmos que o mobile já usava.
 */
export function HomeHero({ brand, content, navLinks, menuLabels }: HomeHeroProps) {
  return (
    <section className="relative min-h-[100svh] w-full overflow-hidden bg-[#05070b]">
      <SiteHeader brand={brand} links={navLinks} menuLabels={menuLabels} />

      {/* ===== Fundo: vídeo em cover + pôster + gradiente de legibilidade ===== */}
      <div aria-hidden className="absolute inset-0 overflow-hidden">
        <Image
          src={POSTER}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-50"
        />
        {/* Iframe dimensionado para COBRIR a viewport mantendo 16:9 (mesma
            matemática do board anterior, agora com o aspect do vídeo):
            largura = max(100vw, 100svh × 16/9), centralizado nos dois eixos.
            `pointer-events-none` — é cenário, não player: sem controles, sem
            foco (tabIndex -1), o clique atravessa para o conteúdo. */}
        <iframe
          src={VIDEO_EMBED}
          title={content.sceneAlt}
          tabIndex={-1}
          allow="autoplay; encrypted-media"
          className="pointer-events-none absolute left-1/2 top-1/2 aspect-video -translate-x-1/2 -translate-y-1/2 border-0"
          style={{ width: "max(100vw, calc(100svh * 16 / 9))" }}
        />
        {/* Véu dual-tone + escurecimento progressivo para o texto central e a
            transição para a seção seguinte (mesma linguagem do hero mobile
            anterior). */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#05070b]/70 via-[#05070b]/35 to-[#05070b]" />
      </div>

      {/* ===== Conteúdo central (padrão WEG: tudo no eixo) ===== */}
      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-4xl flex-col items-center justify-center gap-5 px-6 pb-20 pt-24 text-center md:gap-6">
        <motion.p
          variants={fade}
          initial="hidden"
          animate="show"
          custom={0}
          className="text-glow-cyan text-meta font-semibold uppercase tracking-[0.2em] text-neon-cyan-bright"
        >
          {content.eyebrow}
        </motion.p>
        {/* A headline visível é o LOGOTIPO da ROCO (pedido do stakeholder,
            2026-08-12) — o texto do dicionário permanece no h1 como sr-only,
            preservando SEO e leitores de tela. */}
        <motion.h1
          variants={fade}
          initial="hidden"
          animate="show"
          custom={1}
          className="flex justify-center"
        >
          <Image
            src={LOGO}
            alt={brand}
            width={300}
            height={122}
            priority
            className="h-16 w-auto drop-shadow-[0_0_28px_rgba(53,217,255,0.35)] md:h-24"
          />
          <span className="sr-only">{content.headline}</span>
        </motion.h1>
        <motion.p
          variants={fade}
          initial="hidden"
          animate="show"
          custom={2}
          className="max-w-2xl text-balance text-lede text-white/85"
        >
          {content.description}
        </motion.p>
        <motion.div
          variants={fade}
          initial="hidden"
          animate="show"
          custom={3}
          className="mt-3 flex w-full max-w-xs flex-col gap-4 sm:w-auto sm:max-w-none sm:flex-row sm:gap-5"
        >
          <a
            href={content.primaryCta.href}
            {...externalProps(content.primaryCta.href)}
            className="btn-neon"
          >
            {content.primaryCta.label}
            <ArrowRight className="size-4" aria-hidden />
          </a>
          <a
            href={content.secondaryCta.href}
            {...externalProps(content.secondaryCta.href)}
            className="btn-neon btn-neon--amber"
          >
            <Download className="size-4" aria-hidden />
            {content.secondaryCta.label}
          </a>
        </motion.div>
      </div>

      {/* Indicador de scroll (padrão WEG) — convida a descer para o conteúdo. */}
      <motion.button
        type="button"
        onClick={() => window.scrollBy({ top: window.innerHeight * 0.9, behavior: "smooth" })}
        aria-label={content.scrollCue}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1, duration: 0.8 }}
        className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 text-white/60 transition hover:text-white"
      >
        <ChevronDown className="size-7 animate-bounce" aria-hidden />
      </motion.button>
    </section>
  );
}
