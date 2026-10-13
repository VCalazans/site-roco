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
export const siteUrl = ((process.env.NEXT_PUBLIC_SITE_URL?.trim() || "") || "https://roco.com.br").replace(/\/+$/, "");

/** Imagem de compartilhamento padrão, no tamanho que as redes esperam (1200×630). */
export const DEFAULT_OG_IMAGE = { url: "/images/og/roco-og.jpg", width: 1200, height: 630 } as const;

/** URL absoluta no domínio canônico (`/pt/produtos` → `https://roco.com.br/pt/produtos`). */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Código BCP 47 de cada locale (hreflang e `<html lang>`). */
export const LOCALE_LANGUAGE_TAGS = { pt: "pt-BR", en: "en" } as const;

/**
 * `canonical` + `hreflang` de uma página pública. `path` é o caminho DEPOIS
 * do locale (`""` para a home, `"/produtos"`, `"/produtos?category=gas"`): as
 * rotas não são traduzidas, então a versão em outro idioma só troca o prefixo.
 * `x-default` aponta para o português (idioma principal e destino do `/`).
 */
export function buildAlternates(locale: "pt" | "en", path = "") {
  const suffix = path && !path.startsWith("/") && !path.startsWith("?") ? `/${path}` : path;
  return {
    canonical: absoluteUrl(`/${locale}${suffix}`),
    languages: {
      [LOCALE_LANGUAGE_TAGS.pt]: absoluteUrl(`/pt${suffix}`),
      [LOCALE_LANGUAGE_TAGS.en]: absoluteUrl(`/en${suffix}`),
      "x-default": absoluteUrl(`/pt${suffix}`),
    },
  };
}

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
  // Sem sufixo de marca no template: TODO título de página já carrega "ROCO"
  // (dicionários `*.seo.title`, "{produto} — ROCO", "{tela} — ROCO Portal"), e
  // o antigo "%s | ROCO" duplicava a marca em todas elas ("Meu orçamento —
  // ROCO | ROCO").
  title: {
    default: "ROCO — Soluções Hidrossanitárias e Hidráulicas",
    template: "%s",
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
        url: DEFAULT_OG_IMAGE.url,
        width: DEFAULT_OG_IMAGE.width,
        height: DEFAULT_OG_IMAGE.height,
        alt: "ROCO",
      },
    ],
  },
};
