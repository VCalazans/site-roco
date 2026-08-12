import type { CSSProperties } from "react";
import { cn } from "@/core/lib/utils";
import { externalProps, type Cta } from "@/shared/lib/nav";

type CtaHotspotProps = {
  cta: Cta;
  /** Absolute rect (from the measured .psd) over the baked neon button. */
  style: CSSProperties;
  /**
   * Matches the tone of the neon button baked into the render underneath
   * (cyan on the left, amber on the right — see `hero-layout.ts`). Feeds a
   * soft tinted glow on hover/focus so the click reads as a natural extension
   * of the artwork's own light instead of a generic white tint.
   */
  tone?: "cyan" | "amber";
};

/**
 * Transparent, accessible hotspot layered over one of the neon buttons that are
 * baked into the desktop render. It carries the real href + label so the button
 * stays keyboard-focusable and indexable even though the visual is part of the
 * image.
 */
export function CtaHotspot({ cta, style, tone = "cyan" }: CtaHotspotProps) {
  return (
    <a
      href={cta.href}
      {...externalProps(cta.href)}
      aria-label={cta.label}
      className={cn(
        "absolute rounded-full transition duration-200",
        tone === "amber"
          ? "hover:bg-neon-amber/10 hover:shadow-[0_0_26px_rgba(245,163,60,0.45)] focus-visible:bg-neon-amber/10 focus-visible:shadow-[0_0_26px_rgba(245,163,60,0.45)]"
          : "hover:bg-neon-cyan/10 hover:shadow-[0_0_26px_rgba(53,217,255,0.45)] focus-visible:bg-neon-cyan/10 focus-visible:shadow-[0_0_26px_rgba(53,217,255,0.45)]"
      )}
      style={style}
    />
  );
}
