"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight, Download } from "lucide-react";
import { SiteHeader } from "@/shared/components/nav";
import { CtaHotspot } from "@/modules/landing/components/cta-hotspot";
import { POS, fade } from "@/modules/landing/lib/hero-layout";
import { externalProps, type Cta, type NavLink } from "@/shared/lib/nav";

type ComingSoonContent = {
  brand: string;
  headline: string;
  description: string;
  primaryCta: Cta;
  secondaryCta: Cta;
  sceneAlt: string;
};

type ComingSoonHeroProps = {
  content: ComingSoonContent;
  navLinks: NavLink[];
  menuLabels: { open: string; close: string };
};

/**
 * Cena do hero SEM a barra de navegação.
 *
 * Derivada do antigo `hero-scene.jpg` (3224x1724), que trazia a barra e o
 * logotipo pintados no topo, recortando em y=240 — logo abaixo do filete neon
 * que fechava a barra. Nome novo de propósito: além de deixar a mudança
 * explícita, troca a URL e evita que o otimizador de imagens do Next (e
 * qualquer CDN) sirva a arte antiga de cache. O original segue no histórico.
 */
const SCENE = "/images/hero/hero-stage.jpg";

export function ComingSoonHero({
  content,
  navLinks,
  menuLabels,
}: ComingSoonHeroProps) {
  return (
    <section className="relative flex min-h-[100svh] w-full items-center justify-center overflow-hidden bg-[#05070b]">
      {/* ================= DESKTOP / TABLET — aspect-locked render + aligned overlay =================
          The whole render is shown undistorted so the live overlays (headline, paragraph, CTA
          hotspots) stay aligned to the baked art. On screens whose ratio differs from the art
          (~2.17:1) there are dark margins — the trade-off for never cropping content.

          A barra de nav NÃO faz mais parte da arte: o render foi recortado em y=240 (ver
          `hero-layout.ts`) e o `SiteHeader` — o mesmo componente do catálogo — flutua sobre a
          cena. É o que faz as duas páginas usarem exatamente a mesma barra, mesmo logo e mesmas
          proporções, em vez de uma pintada e outra viva. */}
      <div className="hidden md:flex md:h-[100svh] md:w-full md:items-center md:justify-center">
        <div
          className="hero-board relative aspect-[3224/1484] w-full"
          style={{ maxWidth: "min(100vw, calc(100svh * 3224 / 1484))" }}
        >
          <Image
            src={SCENE}
            alt={content.sceneAlt}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />

          {/* Ancorado ao board (que é `relative`), não à viewport: assim a barra
              acompanha a largura da arte quando a tela é mais alta que 2.17:1 e
              o board deixa de ocupar a largura inteira. */}
          <SiteHeader
            brand={content.brand}
            links={navLinks}
            menuLabels={menuLabels}
          />

          {/* Headline + paragraph (translatable, selectable, indexable) */}
          <div
            className="absolute flex flex-col"
            style={{
              left: POS.copy.left,
              top: POS.copy.top,
              width: POS.copy.width,
              gap: "0.9cqw",
            }}
          >
            <motion.h1
              variants={fade}
              initial="hidden"
              animate="show"
              custom={0}
              className="text-glow-soft whitespace-nowrap font-display text-h1 text-white"
            >
              {content.headline}
            </motion.h1>
            <motion.p
              variants={fade}
              initial="hidden"
              animate="show"
              custom={1}
              className="text-glow-soft text-lede text-white/85"
            >
              {content.description}
            </motion.p>
          </div>

          {/* Transparent, accessible hotspots over the baked neon buttons */}
          <CtaHotspot cta={content.primaryCta} style={{ ...POS.btnPrimary }} />
          <CtaHotspot cta={content.secondaryCta} style={{ ...POS.btnSecondary }} />
        </div>
      </div>

      {/* ================= MOBILE — atmospheric render + rebuilt live foreground ================= */}
      <div className="flex w-full flex-col md:hidden">
        <Image
          src={SCENE}
          alt=""
          aria-hidden
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-45"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#05070b]/60 via-[#05070b]/40 to-[#05070b]" />

        {/* Mesma barra do desktop e do catálogo — o SiteHeader já colapsa
            sozinho no hambúrguer abaixo de `md`. */}
        <SiteHeader
          brand={content.brand}
          links={navLinks}
          menuLabels={menuLabels}
        />

        {/* Content */}
        <div className="relative z-10 flex min-h-[100svh] flex-col items-center justify-center gap-6 px-6 pt-24 pb-16 text-center">
          <motion.h1
            variants={fade}
            initial="hidden"
            animate="show"
            custom={0}
            className="text-glow-cyan font-display text-h1 text-white"
          >
            {content.headline}
          </motion.h1>
          <motion.p
            variants={fade}
            initial="hidden"
            animate="show"
            custom={1}
            className="max-w-md text-body text-white/80"
          >
            {content.description}
          </motion.p>
          <motion.div
            variants={fade}
            initial="hidden"
            animate="show"
            custom={2}
            className="mt-2 flex w-full max-w-xs flex-col gap-4"
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
      </div>
    </section>
  );
}
