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
  const mautic = "https://mautic.roco.com.br";

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // O domínio do Mautic entra aqui por causa do pixel de tracking
    // (`mtracking.gif`): o `mtc.js` tenta primeiro um POST em `/mtc/event`
    // (coberto por `connect-src`) e, se o CORS falhar, recorre a uma <img>.
    `img-src 'self' data: blob: ${mautic}`,
    "font-src 'self'",
    `connect-src 'self' ${mautic}${isDev ? " ws: http://localhost:*" : ""}`,
    `form-action 'self' ${mautic}`,
    // O SDK do Mautic posta o formulário num iframe oculto e lê a resposta JSON
    // via postMessage — sem esta diretiva o iframe é bloqueado por `default-src`
    // e a página nunca sabe se o envio deu certo (a página de catálogo depende
    // disso para liberar o PDF). Permitir *enquadrar* o Mautic não dá a ele
    // nenhum acesso a este documento nem permite executar script na nossa origem.
    `frame-src 'self' ${mautic}`,
  ].join("; ");
}

export default nextConfig;
