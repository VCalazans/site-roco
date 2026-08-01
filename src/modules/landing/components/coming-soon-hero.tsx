"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight, Download } from "lucide-react";
import { useContactForm } from "@/shared/components/contact-form";
import { MobileMenu, NavItems } from "@/shared/components/nav";
import { CtaHotspot } from "@/modules/landing/components/cta-hotspot";
import { POS, fade } from "@/modules/landing/lib/hero-layout";
import {
  externalProps,
  navLabelClass,
  type Cta,
  type NavLink,
} from "@/shared/lib/nav";

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

const SCENE = "/images/hero/hero-scene.jpg";
const WORDMARK = "/images/hero/roco-logo.png";

export function ComingSoonHero({
  content,
  navLinks,
  menuLabels,
}: ComingSoonHeroProps) {
  const { open: openContact } = useContactForm();

  return (
    <section className="relative flex min-h-[100svh] w-full items-center justify-center overflow-hidden bg-[#05070b]">
      {/* ================= DESKTOP / TABLET — aspect-locked render + aligned overlay =================
          The whole render is shown undistorted so the live overlays (nav, headline, paragraph,
          CTA hotspots) stay aligned to the baked art. On screens whose ratio differs from the
          art (~1.87:1) there are thin dark margins — the trade-off for never cropping content. */}
      <div className="hidden md:flex md:h-[100svh] md:w-full md:items-center md:justify-center">
        <div
          className="hero-board relative aspect-[3224/1724] w-full"
          style={{ maxWidth: "min(100vw, calc(100svh * 3224 / 1724))" }}
        >
          <Image
            src={SCENE}
            alt={content.sceneAlt}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />

          {/* Live nav labels over the baked glass bar.
              Ancorado pelo CENTRO (`POS.nav.top` + `-translate-y-1/2`): assim o
              bloco cresce e encolhe simetricamente em torno da linha média do
              vidro pintado, e mudar o tamanho da fonte deixa de empurrar os
              rótulos para baixo dentro da arte. Os 6.75% foram MEDIDOS do
              render atual (centro do primeiro item / altura do board), estáveis
              em 1920x1080, 1920x800, 1440x900 e 2560x1440. */}
          <nav
            className="absolute flex -translate-y-1/2 items-center"
            style={{ top: POS.nav.top, right: POS.nav.right, gap: "2.2cqw" }}
          >
            <NavItems
              links={navLinks}
              onContact={openContact}
              itemClassName={(index) => navLabelClass(index, "bar")}
            />
          </nav>

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

        {/* Top bar */}
        <nav className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 py-5">
          <Image
            src={WORDMARK}
            alt={content.brand}
            width={110}
            height={45}
            className="h-7 w-auto"
            priority
          />
          <MobileMenu
            links={navLinks}
            onContact={openContact}
            labels={menuLabels}
          />
        </nav>

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
