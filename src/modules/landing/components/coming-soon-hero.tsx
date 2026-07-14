"use client";

import Image from "next/image";
import { motion, type Variants } from "framer-motion";
import { ArrowRight, Download } from "lucide-react";
import { useContactForm } from "@/shared/components/contact-form";

type Cta = { label: string; href: string };

type ComingSoonContent = {
  brand: string;
  headline: string;
  description: string;
  primaryCta: Cta;
  secondaryCta: Cta;
  sceneAlt: string;
};

type NavLink = { label: string; href: string };

type ComingSoonHeroProps = {
  content: ComingSoonContent;
  navLinks: NavLink[];
};

const SCENE = "/images/hero/hero-scene.jpg";
const WORDMARK = "/images/hero/roco-logo-white.png";

/**
 * Coordinates measured from the source .psd (canvas 3224 x 1724), expressed as
 * percentages so the live overlay stays aligned with the baked render at every
 * width. The render already contains the ROCO wordmark, nav pill and both neon
 * buttons; only the translatable text (nav labels, headline, paragraph) and the
 * clickable CTA hotspots are layered on top.
 */
const POS = {
  nav: { top: "5.0%", right: "6.6%" },
  copy: { left: "29.1%", top: "51.5%", width: "42%" },
  btnPrimary: { left: "34.8%", top: "79.2%", width: "17.6%", height: "8.8%" },
  btnSecondary: { left: "53.0%", top: "79.2%", width: "12.4%", height: "8.8%" },
} as const;

const fade: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      delay: 0.15 * i,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  }),
};

export function ComingSoonHero({ content, navLinks }: ComingSoonHeroProps) {
  const { open: openContact } = useContactForm();

  return (
    <section className="relative flex min-h-[100svh] w-full items-center justify-center overflow-hidden bg-[#05070b]">
      {/* ================= DESKTOP / TABLET — aspect-locked render + aligned overlay ================= */}
      <div className="hidden md:flex md:h-[100svh] md:w-full md:items-center md:justify-center">
        <div
          className="relative aspect-[3224/1724] w-full"
          style={{
            maxWidth: "min(100vw, calc(100svh * 3224 / 1724))",
            containerType: "inline-size",
          }}
        >
          <Image
            src={SCENE}
            alt={content.sceneAlt}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />

          {/* Live nav labels over the baked pill */}
          <nav
            className="absolute flex items-center"
            style={{ top: POS.nav.top, right: POS.nav.right, gap: "2.2cqw" }}
          >
            {navLinks.map((link, i) => {
              const cls =
                i === 0
                  ? "text-glow-cyan font-medium text-neon-cyan-bright transition hover:opacity-90"
                  : "font-medium text-white/85 transition hover:text-white";
              const style = { fontSize: "1.05cqw" };
              return link.href.startsWith("#contato") ? (
                <button key={link.label} type="button" onClick={openContact} className={cls} style={style}>
                  {link.label}
                </button>
              ) : (
                <a key={link.label} href={link.href} className={cls} style={style}>
                  {link.label}
                </a>
              );
            })}
          </nav>

          {/* Headline + paragraph (translatable, selectable, indexable) */}
          <div
            className="absolute flex flex-col"
            style={{
              left: POS.copy.left,
              top: POS.copy.top,
              width: POS.copy.width,
              gap: "1.4cqw",
            }}
          >
            <motion.h1
              variants={fade}
              initial="hidden"
              animate="show"
              custom={0}
              className="text-glow-soft font-display font-bold leading-[1.03] text-white"
              style={{ fontSize: "3.4cqw" }}
            >
              {content.headline}
            </motion.h1>
            <motion.p
              variants={fade}
              initial="hidden"
              animate="show"
              custom={1}
              className="text-glow-soft font-medium text-white/85"
              style={{ fontSize: "1.4cqw", lineHeight: 1.5 }}
            >
              {content.description}
            </motion.p>
          </div>

          {/* Transparent, accessible hotspots over the baked neon buttons */}
          <a
            href={content.primaryCta.href}
            aria-label={content.primaryCta.label}
            className="absolute rounded-full transition hover:bg-white/[0.04] focus-visible:bg-white/[0.06]"
            style={{
              left: POS.btnPrimary.left,
              top: POS.btnPrimary.top,
              width: POS.btnPrimary.width,
              height: POS.btnPrimary.height,
            }}
          />
          <a
            href={content.secondaryCta.href}
            aria-label={content.secondaryCta.label}
            className="absolute rounded-full transition hover:bg-white/[0.04] focus-visible:bg-white/[0.06]"
            style={{
              left: POS.btnSecondary.left,
              top: POS.btnSecondary.top,
              width: POS.btnSecondary.width,
              height: POS.btnSecondary.height,
            }}
          />
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

        {/* Top bar */}
        <nav className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-6 py-5">
          <Image
            src={WORDMARK}
            alt={content.brand}
            width={110}
            height={45}
            className="h-7 w-auto"
            priority
          />
          <div className="flex items-center gap-4 text-sm">
            {navLinks.map((link, i) => {
              const cls = i === 0 ? "font-medium text-neon-cyan-bright" : "text-white/80";
              return link.href.startsWith("#contato") ? (
                <button key={link.label} type="button" onClick={openContact} className={cls}>
                  {link.label}
                </button>
              ) : (
                <a key={link.label} href={link.href} className={cls}>
                  {link.label}
                </a>
              );
            })}
          </div>
        </nav>

        {/* Content */}
        <div className="relative z-10 flex min-h-[100svh] flex-col items-center justify-center gap-6 px-6 pt-24 pb-16 text-center">
          <motion.h1
            variants={fade}
            initial="hidden"
            animate="show"
            custom={0}
            className="text-glow-cyan font-display text-3xl font-bold leading-tight text-white sm:text-4xl"
          >
            {content.headline}
          </motion.h1>
          <motion.p
            variants={fade}
            initial="hidden"
            animate="show"
            custom={1}
            className="max-w-md text-base leading-relaxed text-white/80"
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
            <a href={content.primaryCta.href} className="btn-neon">
              {content.primaryCta.label}
              <ArrowRight className="size-4" aria-hidden />
            </a>
            <a href={content.secondaryCta.href} className="btn-neon btn-neon--amber">
              <Download className="size-4" aria-hidden />
              {content.secondaryCta.label}
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
