import type { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://roco.com.br";

/**
 * Título/descrição default (fallback de `openGraph`/`twitter`, que as páginas
 * localizadas não sobrescrevem individualmente — só `title`/`description`
 * simples via `generateMetadata`). Copy atualizada nesta sessão: a home
 * deixou de ser a página "Em breve" (ver decisionLog 2026-08-11); o texto
 * antigo ("Tem novidade chegando!") ficaria incoerente com o site real agora
 * publicado. Espelha `dictionary.seo` de `pt.json` — este arquivo é
 * locale-agnostic (mesmo padrão anterior, PT como default), então não lê o
 * dicionário diretamente.
 */
export const defaultMetadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "ROCO — Soluções Hidrossanitárias e Hidráulicas",
    template: "%s | ROCO",
  },
  description:
    "ROCO. Soluções em hidrossanitários, hidráulica e componentes industriais. Fabricante brasileira com presença nacional e exportação.",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    title: "ROCO — Soluções Hidrossanitárias e Hidráulicas",
    description:
      "ROCO. Soluções em hidrossanitários, hidráulica e componentes industriais. Fabricante brasileira com presença nacional e exportação.",
    images: [
      {
        // Dimensões declaradas como as reais do arquivo: o antigo 1200x630 não
        // batia com a imagem e algumas redes recortam pelo valor anunciado.
        url: "/images/hero/hero-stage.jpg",
        width: 3224,
        height: 1484,
        alt: "ROCO",
      },
    ],
  },
};
