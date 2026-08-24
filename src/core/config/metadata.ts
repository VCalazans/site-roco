import type { Metadata } from "next";

/**
 * `siteUrl` é embutido no `metadataBase` em build-time (Next 14+ exige URL
 * absoluta no construtor de `URL`). O Dockerfile passa
 * `NEXT_PUBLIC_SITE_URL` como build-arg com default vazio — se o arg não
 * for definido em produção, o `new URL("")` crasha o build. Por isso
 * a cadeia de fallback trata `""` e `undefined` como ausência: o placeholder
 * é o último recurso (só aparece se o deploy esquecer de passar o arg).
 *
 * Em produção real (go-live), `NEXT_PUBLIC_SITE_URL=https://roco.com.br`
 * precisa ser passado como `--build-arg` no `docker build`. Se
 * esquecido, o site sobe com o placeholder e o `metadataBase` aponta para
 * ele — não bloqueia o deploy, mas o sitemap/OG/canonical ficam errados.
 */
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "") || "https://roco.com.br";

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
