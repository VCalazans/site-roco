import { ExternalLink } from "lucide-react";
import { cn } from "@/core/lib/utils";
import type { Dictionary } from "@/i18n/get-dictionary";
import { askAiLinks } from "@/modules/ai/lib/ask-ai";

type AskAiLinksProps = {
  prompt: string;
  copy: Pick<Dictionary["askAi"], "assistants" | "newTab">;
  size?: "md" | "sm";
  className?: string;
};

/**
 * Botões "Perguntar ao ChatGPT / Claude / Perplexity" com a pergunta já
 * escrita. São links comuns para o serviço de cada um, em nova aba: nada é
 * enviado pelo site.
 */
export function AskAiLinks({ prompt, copy, size = "md", className }: AskAiLinksProps) {
  return (
    <ul className={cn("flex flex-wrap gap-3", className)}>
      {askAiLinks(prompt).map(({ assistant, url }, index) => (
        <li key={assistant}>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "btn-neon w-fit",
              index % 2 === 1 && "btn-neon--amber",
              size === "sm" && "px-4 py-2 text-meta"
            )}
          >
            {copy.assistants[assistant]}
            <ExternalLink className="size-4" aria-hidden />
            <span className="sr-only">{copy.newTab}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
