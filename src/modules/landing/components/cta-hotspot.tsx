import type { CSSProperties } from "react";
import { externalProps, type Cta } from "@/shared/lib/nav";

type CtaHotspotProps = {
  cta: Cta;
  /** Absolute rect (from the measured .psd) over the baked neon button. */
  style: CSSProperties;
};

/**
 * Transparent, accessible hotspot layered over one of the neon buttons that are
 * baked into the desktop render. It carries the real href + label so the button
 * stays keyboard-focusable and indexable even though the visual is part of the
 * image.
 */
export function CtaHotspot({ cta, style }: CtaHotspotProps) {
  return (
    <a
      href={cta.href}
      {...externalProps(cta.href)}
      aria-label={cta.label}
      className="absolute rounded-full transition hover:bg-white/[0.04] focus-visible:bg-white/[0.06]"
      style={style}
    />
  );
}
