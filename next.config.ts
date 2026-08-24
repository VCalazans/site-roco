import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // i18n is handled via middleware + app router [locale] segments (see middleware.ts)

  // Pin the workspace root to this project (a stray parent lockfile confuses inference)
  turbopack: { root: projectRoot },
  outputFileTracingRoot: projectRoot,

  // Standalone output for lean Docker production images
  output: "standalone",

  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: getRemotePatterns(),
  },

  // Baseline security headers
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy() },
        ],
      },
    ];
  },
};

/**
 * Content-Security-Policy.
 *
 * Defesa central pós-incidente ClickFix (2026-07): `script-src 'self'` (sem o
 * domínio do Mautic) impede que qualquer script seja CARREGADO de fora do
 * próprio site. O formulário Mautic passa a rodar de uma cópia self-hosted
 * (`/vendor/mautic-form.js`) e só o POST de envio vai para o Mautic — coberto
 * por `connect-src`/`form-action`. Assim, mesmo que o servidor Mautic seja
 * reinfectado, o navegador bloqueia scripts de terceiros neste site.
 *
 * O tracking de visitantes segue a mesma regra: cópia verificada do `mtc.js` em
 * `/vendor/mautic-tracking.js` (ver `src/shared/components/analytics/`), com os
 * hits saindo por `connect-src` (`/mtc/event`) ou `img-src` (`mtracking.gif`).
 *
 * `'unsafe-inline'` em script-src é necessário para os scripts inline de
 * hidratação do Next.js (sem nonce). Como o HTML do site é estático (sem ponto
 * de injeção), o risco residual é baixo; um endurecimento futuro seria migrar
 * para CSP baseada em nonce via middleware.
 *
 * Em desenvolvimento, libera `'unsafe-eval'` e `ws:`/localhost para o HMR do
 * Turbopack — em produção a política é restrita.
 */
function contentSecurityPolicy(): string {
  const isDev = process.env.NODE_ENV !== "production";

  // Cloudflare R2 (portal interno): o upload de imagens de produto e documentos
  // de representante é um PUT presignado feito DIRETO do navegador para o
  // endpoint da conta R2 (`connect-src`); as imagens públicas do catálogo são
  // servidas do bucket público (`img-src`). Nada disso toca `script-src`.
  const r2Endpoint = process.env.R2_ACCOUNT_ID
    ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : "";
  const r2Public = process.env.R2_PUBLIC_URL
    ? new URL(process.env.R2_PUBLIC_URL).origin
    : "";

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // R2 público (catálogo de imagens) + MAUTIC removido em 2026-08-23.
    `img-src 'self' data: blob:${r2Public ? ` ${r2Public}` : ""}`,
    // Vídeo do hero servido do R2 (slides `kind: "upload"` — ver
    // `hero-slider.tsx`). SEM esta diretiva o `<video>` cairia no
    // `default-src 'self'` e o navegador bloquearia o arquivo: o hero
    // ficaria só no pôster, sem erro visível fora do console. Slides
    // YouTube não passam por aqui — são iframe, cobertos por `frame-src`.
    `media-src 'self' blob:${r2Public ? ` ${r2Public}` : ""}`,
    "font-src 'self'",
    `connect-src 'self'${r2Endpoint ? ` ${r2Endpoint}` : ""}${isDev ? " ws: http://localhost:*" : ""}`,
    "form-action 'self'",
    // youtube-nocookie.com: mantido porque o admin pode criar slides YouTube
    // no carrossel do hero (home-slider.tsx) — o rationale de "enquadrar ≠
    // executar script na nossa origem" continua válido. RD Station entra por
    // `script-src 'self'` (carregado de `/vendor/rdstation.js` self-hosted,
    // mesmo padrão do antigo Mautic — ver decisionLog 2026-08-23).
    `frame-src 'self' https://www.youtube-nocookie.com`,
  ].join("; ");
}

/**
 * Remote patterns para otimização de imagens do next/image.
 *
 * Cloudflare R2 (bucket público): permite otimizar imagens de produto servidas
 * do URL público R2 (via R2_PUBLIC_URL definida em build-time e runtime). O
 * otimizador do Next valida o origem antes de fazer o rewrite, então o
 * remotePattern precisa bater com a URL pública do bucket.
 *
 * Se R2_PUBLIC_URL não estiver definida (desenvolvimento sem R2, ou before configuração),
 * o array fica vazio — next/image rejeitará URLs R2, o que é o comportamento
 * esperado (fallback para <img> sem otimização).
 */
function getRemotePatterns(): Array<{
  protocol: "http" | "https";
  hostname: string;
  port?: string;
  pathname?: string;
}> {
  const patterns: Array<{
    protocol: "http" | "https";
    hostname: string;
    port?: string;
    pathname?: string;
  }> = [];

  if (process.env.R2_PUBLIC_URL) {
    try {
      const url = new URL(process.env.R2_PUBLIC_URL);
      const rawPath = url.pathname.replace(/\/+$/, ""); // Remove trailing slashes; "/" becomes ""
      patterns.push({
        protocol: (url.protocol.replace(":", "") as "http" | "https"),
        hostname: url.hostname,
        port: url.port || undefined,
        pathname: `${rawPath}/**`, // Now "/**" for root, "/subpath/**" for subpaths; no double slash
      });
    } catch {
      // Se R2_PUBLIC_URL for inválida, ignora silenciosamente
      // (fallback para sem otimização).
    }
  }

  return patterns;
}

export default nextConfig;
