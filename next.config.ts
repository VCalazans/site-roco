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

function contentSecurityPolicy(): string {
  const isDev = process.env.NODE_ENV !== "production";

  // Cloudflare R2 (portal interno): o upload de imagens de produto, documentos
  // de representante, mídia do hero e materiais é um PUT presignado feito
  // DIRETO do navegador para o R2 (`connect-src`); as imagens públicas do
  // catálogo são servidas do bucket público (`img-src`). Nada toca `script-src`.
  //
  // ATENÇÃO ao formato do host. O AWS SDK gera URL presignada em
  // *virtual-hosted-style* — o bucket vira SUBDOMÍNIO:
  //
  //   https://<bucket>.<conta>.r2.cloudflarestorage.com/materials/…
  //
  // e não o *path-style* que se poderia supor
  // (`https://<conta>.r2.cloudflarestorage.com/<bucket>/…`). Liberar só o host
  // da conta bloqueava TODO upload vindo do navegador com
  // "violates the following Content Security Policy directive: connect-src" —
  // o que manteve o upload de documentos de representante quebrado desde que
  // foi escrito, sem ninguém notar, porque nunca foi exercitado em navegador.
  //
  // O curinga cobre qualquer bucket DA MESMA CONTA (o `<conta>` continua fixo),
  // então não precisa de `R2_BUCKET` como build-arg novo e continua não
  // permitindo host de terceiro.
  const r2Endpoint = process.env.R2_ACCOUNT_ID
    ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com https://*.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : "";
  const r2Public = process.env.R2_PUBLIC_URL
    ? new URL(process.env.R2_PUBLIC_URL).origin
    : "";

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
    //
    // Os hosts entram SEMPRE (não condicionados à flag de tracking) porque a
    // CSP é resolvida em BUILD-TIME e a flag é de runtime: condicionar deixaria
    // a política dependente de quando a imagem foi buildada.
    `script-src 'self' 'unsafe-inline' ${RD_STATION_SCRIPT_HOSTS}${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // R2 público (catálogo de imagens) + MAUTIC removido em 2026-08-23.
    // `d335luupugsy2.cloudfront.net`: o `scout/bundle.js` do RD (banner de
    // consentimento) serve seus próprios assets de imagem do mesmo host.
    `img-src 'self' data: blob: ${RD_STATION_SCRIPT_HOSTS}${r2Public ? ` ${r2Public}` : ""}`,
    // Vídeo do hero servido do R2 (slides `kind: "upload"` — ver
    // `hero-slider.tsx`). SEM esta diretiva o `<video>` cairia no
    // `default-src 'self'` e o navegador bloquearia o arquivo: o hero
    // ficaria só no pôster, sem erro visível fora do console. Slides
    // YouTube não passam por aqui — são iframe, cobertos por `frame-src`.
    `media-src 'self' blob:${r2Public ? ` ${r2Public}` : ""}`,
    "font-src 'self'",
    // RD Station: os hits de tracking (pageview, conversão, identificação do
    // visitante) saem por XHR/fetch para a API do RD e para as CDNs acima.
    // Sem isto o script CARREGA mas nenhum dado chega ao RD — falha silenciosa,
    // visível só no console.
    `connect-src 'self' ${RD_STATION_CONNECT_HOSTS}${r2Endpoint ? ` ${r2Endpoint}` : ""}${isDev ? " ws: http://localhost:*" : ""}`,
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
