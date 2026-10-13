import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/core/config/metadata";
import { locales } from "@/i18n/config";

/**
 * Robôs de IA LIBERADOS de propósito (spec 003, decisão D1 de 2026-10-13):
 * - de resposta/busca (citam o site nas respostas): OAI-SearchBot, ChatGPT-User,
 *   Claude-SearchBot, Claude-User, PerplexityBot, Perplexity-User;
 * - de treinamento (a ROCO quer ser conhecida; o catálogo não é produto pago):
 *   GPTBot, ClaudeBot, Google-Extended, Applebot-Extended, CCBot, meta-externalagent.
 * Cada grupo nomeado SUBSTITUI o `*` para aquele robô, então todos repetem as
 * mesmas restrições. Bloquear um deles aqui tira a ROCO das respostas da IA
 * correspondente — e a Cloudflare tem bloqueios de IA próprios que não
 * aparecem neste arquivo (conferir "AI Crawl Control" na zona).
 */
export const AI_CRAWLERS = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "GPTBot",
  "Claude-SearchBot",
  "Claude-User",
  "ClaudeBot",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "meta-externalagent",
] as const;

/** Rotas técnicas ou de estado do visitante — nada a indexar. */
export const DISALLOWED_PATHS = [
  "/api/",
  ...locales.flatMap((locale) => [`/${locale}/portal`, `/${locale}/admin`, `/${locale}/orcamento`]),
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOWED_PATHS },
      { userAgent: [...AI_CRAWLERS], allow: "/", disallow: DISALLOWED_PATHS },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
