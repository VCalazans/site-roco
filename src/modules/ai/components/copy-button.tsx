"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/core/lib/utils";

type CopyButtonProps = { value: string; label: string; copiedLabel: string; className?: string };

/** Copia um texto (ex.: o endereço do conector) e confirma na própria etiqueta, com aviso para leitor de tela. */
export function CopyButton({ value, label, copiedLabel, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Sem permissão de área de transferência: o endereço continua visível para copiar à mão.
    }
  }

  return (
    <button type="button" onClick={copy} className={cn("btn-neon w-fit", className)}>
      {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      <span aria-live="polite">{copied ? copiedLabel : label}</span>
    </button>
  );
}
