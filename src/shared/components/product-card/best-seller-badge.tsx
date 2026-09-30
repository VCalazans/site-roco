import { Trophy } from "lucide-react";
import { cn } from "@/core/lib/utils";

type BestSellerBadgeProps = {
  /** Rótulo completo — nome acessível SEMPRE ("Campeão de vendas"). */
  label: string;
  /** Rótulo curto visível no card (ex.: "Campeão"); ausente = só o ícone. */
  shortLabel?: string;
  /** `"card"`: selo compacto sobre a foto; `"detail"`: selo destacado no detalhe. */
  variant?: "card" | "detail";
  className?: string;
};

/**
 * Selo "Campeão de vendas" (spec 001, RF08) — troféu no âmbar da marca, com o
 * mesmo vocabulário visual do site (vidro escuro + borda/glow neon), em vez de
 * uma etiqueta genérica de e-commerce. O âmbar é o lado "quente" do dual-tone
 * da ROCO e já sinaliza destaque no resto do site (eyebrows, CTA secundário).
 *
 * Acessibilidade: o nome completo vai em `title` e num texto `sr-only` quando
 * o rótulo visível é abreviado — leitor de tela ouve "Campeão de vendas", não
 * "Campeão".
 */
export function BestSellerBadge({ label, shortLabel, variant = "card", className }: BestSellerBadgeProps) {
  if (variant === "detail") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-neon-amber/60 bg-gradient-to-r from-[#2a1804]/90 to-[#140c03]/90 py-1.5 pl-2 pr-4 text-micro font-semibold uppercase tracking-[0.12em] text-neon-amber-bright shadow-[0_0_24px_-4px_rgba(255,180,84,0.55)]",
          className
        )}
      >
        <span className="flex size-6 items-center justify-center rounded-full bg-neon-amber-bright/15 ring-1 ring-neon-amber-bright/50">
          <Trophy className="size-3.5" aria-hidden />
        </span>
        {label}
      </span>
    );
  }

  return (
    <span
      title={label}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-neon-amber/60 bg-[#1a1206]/85 px-2 py-1 text-micro font-semibold text-neon-amber-bright shadow-[0_0_16px_rgba(255,180,84,0.35)] backdrop-blur-sm",
        className
      )}
    >
      <Trophy className="size-3.5 shrink-0" aria-hidden />
      {shortLabel ? (
        <>
          <span aria-hidden>{shortLabel}</span>
          <span className="sr-only">{label}</span>
        </>
      ) : (
        <span className="sr-only">{label}</span>
      )}
    </span>
  );
}
