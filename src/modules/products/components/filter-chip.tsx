"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/core/lib/utils";

type FilterChipProps = {
  label: string;
  removeLabel: string;
  onRemove: () => void;
  icon?: ReactNode;
  tone?: "cyan" | "amber";
};

/**
 * Chip de um filtro ativo da listagem, com botão de remover. Renderiza um
 * `<li>`: vai sempre dentro de uma lista rotulada (faixa "Filtros ativos" e
 * termos fixados sob o campo de busca).
 */
export function FilterChip({ label, removeLabel, onRemove, icon, tone = "cyan" }: FilterChipProps) {
  return (
    <li>
      <span
        className={cn(
          "inline-flex max-w-[16rem] items-center gap-1.5 rounded-full border py-1 pl-3 pr-1 text-micro font-semibold",
          tone === "amber"
            ? "border-neon-amber/50 bg-neon-amber/10 text-neon-amber-bright"
            : "border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan-bright"
        )}
      >
        {icon}
        <span className="truncate">{label}</span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          title={removeLabel}
          className="flex size-6 items-center justify-center rounded-full transition hover:bg-white/10"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </span>
    </li>
  );
}
