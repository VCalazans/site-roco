import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Nomes de tamanho da escala tipográfica do projeto (ver `@theme` em
 * `globals.css`). Precisam ser declarados aqui porque não são t-shirt sizes:
 * sem isso o tailwind-merge classifica `text-nav` como COR de texto e a
 * descarta ao ver `text-white/90` na mesma chamada de `cn()` — a classe some do
 * className sem erro nenhum e o elemento volta a herdar o tamanho do body.
 */
const TYPE_SCALE = ["h1", "h2", "lede", "nav", "body", "ui", "meta", "micro"];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: TYPE_SCALE }],
    },
  },
});

/**
 * Merge conditional class names and resolve Tailwind conflicts.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
