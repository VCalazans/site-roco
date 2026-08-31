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
 * Hosts do RD Station liberados na CSP.
 *
 * `d335luupugsy2.cloudfront.net` serve o loader e a maior parte da cadeia;
 * `d1sag09wwfbul8.cloudfront.net` serve o `rdtracker.min.js`. Ambos foram
 * levantados lendo o loader real (ver comentário em `script-src`), não
 * presumidos a partir da documentação.
 */
const RD_STATION_SCRIPT_HOSTS =
  "https://d335luupugsy2.cloudfront.net https://d1sag09wwfbul8.cloudfront.net";

/**
 * Destinos dos hits de tracking. Inclui os hosts de script (as CDNs também
 * recebem beacons) mais `app.rdstation.com.br`, que é para onde a API de
 * eventos do RD envia.
 */
const RD_STATION_CONNECT_HOSTS = `${RD_STATION_SCRIPT_HOSTS} https://app.rdstation.com.br`;

/**
 * Content-Security-Policy.
 *
 * Defesa central pós-incidente ClickFix (2026-07): o `script-src` NÃO inclui o
 * domínio do Mautic. O formulário Mautic — que continua sendo o único caminho
 * de captação de lead nesta branch — roda de uma cópia self-hosted
 * (`/vendor/mautic-form.js`) e só o POST de envio vai para o servidor do
 * Mautic, coberto por `connect-src`/`form-action`/`frame-src`. Mesmo que
 * aquele servidor seja reinfectado, o navegador não executa script dele aqui.
 *
 * O TRACKING de visitantes migrou do Mautic para o RD Station em 2026-08-30
 * (decisão do stakeholder; o RD é a plataforma de marketing da ROCO). O
 * `mtc.js` self-hospedado saiu junto com o componente `MauticTracking`, e as
 * diretivas do Mautic que sobraram existem só para o FORMULÁRIO.
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
    // RD Station (2026-08-30): AFROUXAMENTO DELIBERADO de `script-src 'self'`,
    // decidido pelo stakeholder com o trade-off na mesa.
    //
    // O que a tag `<script src=".../<id>-loader.js">` do painel do RD realmente
    // faz: ela é um LOADER que cria `<script>` em runtime para outros CINCO
    // arquivos, em DOIS hosts —
    //   d335luupugsy2.cloudfront.net → o próprio loader, lead-tracking,
    //     traffic-source-cookie, rd-js-integration e scout/bundle.js
    //   d1sag09wwfbul8.cloudfront.net → rdtracker.min.js
    // Liberar só o host do loader deixaria a cadeia quebrada no meio, sem erro
    // visível fora do console. Por isso os DOIS hosts entram.
    //
    // ⚠️ Isto reabre parcialmente o vetor fechado após o ClickFix (2026-07):
    // um comprometimento da CDN do RD passa a poder executar script NESTA
    // origem. A alternativa era self-hospedar as cópias (padrão adotado com o
    // Mautic em `public/vendor/`), rejeitada aqui porque o RD atualiza esses
    // arquivos sem aviso — a cópia congelaria e quebraria o tracking em
    // silêncio. Auditoria do loader em 2026-08-30 (SHA-256
    // db41b8264d5077f687fa41f9172f9249aee569e53c0af51abb216ce388650976):
    // zero indicadores de ClickFix (`clipboard.writeText`, `execCommand`,
    // `powershell`, `mshta`, `eval(`, `new Function`, `atob`, `fromCharCode`,
    // `unescape`, `document.write` — todos com 0 ocorrências).
    `script-src 'self' 'unsafe-inline' ${RD_STATION_SCRIPT_HOSTS}${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // `d335luupugsy2.cloudfront.net`: o `scout/bundle.js` do RD (banner de
    // consentimento) serve seus próprios assets de imagem do mesmo host.
    // O domínio do Mautic permanece por causa do formulário.
    `img-src 'self' data: blob: ${RD_STATION_SCRIPT_HOSTS} ${mautic}`,
    "font-src 'self'",
    // RD Station: sem isto o script CARREGA mas nenhum hit chega ao RD —
    // falha silenciosa, visível só no console.
    `connect-src 'self' ${RD_STATION_CONNECT_HOSTS} ${mautic}${isDev ? " ws: http://localhost:*" : ""}`,
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
