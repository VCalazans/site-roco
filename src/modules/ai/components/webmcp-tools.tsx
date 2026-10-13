"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { contactPath, productsPath, quotePath } from "@/core/config/site";
import type { Locale } from "@/i18n/config";
import {
  buildWebMcpTools,
  getModelContext,
  type WebMcpDeps,
} from "@/modules/ai/lib/webmcp";
import { addItem, getCart } from "@/shared/lib/cart-store";

type WebMcpToolsProps = { locale: Locale };

/**
 * WebMCP (spec 003): registra no navegador do visitante ferramentas que um
 * agente de IA pode usar NESTA aba — buscar no catálogo, abrir um produto,
 * filtrar a listagem, montar o orçamento e abrir o formulário de contato já
 * com o produto. API em origin trial no Chrome (`document.modelContext`; o nome
 * antigo era `navigator.modelContext`). Sem a API, o componente não faz nada.
 *
 * Nenhuma ferramenta ENVIA formulário: o envio exige a verificação anti-robô e
 * o consentimento LGPD marcados pela própria pessoa. Desligável com
 * `NEXT_PUBLIC_WEBMCP_ENABLED=false`.
 */
export function WebMcpTools({ locale }: WebMcpToolsProps) {
  const router = useRouter();

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_WEBMCP_ENABLED === "false") return;
    const modelContext = getModelContext();
    if (!modelContext) return;

    const controller = new AbortController();
    const cleanups: (() => void)[] = [];

    const deps: WebMcpDeps = {
      locale,
      productsPath: productsPath(locale),
      contactPath: contactPath(locale),
      quotePath: quotePath(locale),
      fetchJson: async (url) => {
        const response = await fetch(url, { headers: { Accept: "application/json" } });
        if (!response.ok) return null;
        return response.json();
      },
      navigate: (href) => router.push(href),
      addToQuote: addItem,
      readQuote: getCart,
    };

    for (const tool of buildWebMcpTools(deps)) {
      try {
        const result = modelContext.registerTool(tool, { signal: controller.signal });
        // Versões antigas devolviam `{ unregister }` em vez de aceitar `signal`.
        Promise.resolve(result)
          .then((registration) => {
            if (registration && typeof registration.unregister === "function") {
              cleanups.push(() => registration.unregister?.());
            }
          })
          .catch(() => undefined);
      } catch {
        // Ferramenta já registrada (remontagem em desenvolvimento) ou API instável: ignora.
      }
    }

    return () => {
      controller.abort();
      for (const cleanup of cleanups) cleanup();
    };
  }, [locale, router]);

  return null;
}
