import Script from "next/script";

/**
 * Tracking de visitantes via RD Station — a plataforma de marketing da ROCO
 * (substituiu o Mautic em 2026-08-23, ver decisionLog).
 *
 * A tag que o painel do RD entrega é um LOADER: ela não faz o tracking, ela
 * cria `<script>` em runtime para outros cinco arquivos (lead-tracking,
 * traffic-source-cookie, rd-js-integration, scout/bundle e rdtracker), em dois
 * hosts de CDN. Por isso a CSP precisou liberar os DOIS hosts em `script-src`
 * — o comentário em `next.config.ts` registra o trade-off, que foi uma decisão
 * consciente do stakeholder e não um descuido.
 *
 * `strategy="afterInteractive"` (e não `beforeInteractive`) porque o tracking
 * não participa da renderização: adiantá-lo só atrasaria o LCP da home, que é
 * a página com vídeo no hero.
 *
 * NÃO é `"use client"`: `next/script` funciona em Server Component, e este
 * componente não tem estado nem handler. Como o `(site)/layout.tsx` já é
 * server, manter aqui evita empurrar mais uma fronteira de cliente para o
 * bundle.
 *
 * CONSENTIMENTO: o próprio loader traz o `RDCookieControl`, que exibe o banner
 * do RD e só dispara os scripts de tracking após a escolha do visitante. Por
 * isso o `ConsentBanner` do projeto segue DESLIGADO
 * (`NEXT_PUBLIC_CONSENT_ENABLED`) — dois banners na mesma página seria pior
 * para o visitante e para a prova de consentimento. Decisão do stakeholder em
 * 2026-08-30.
 */

/**
 * URL do loader do RD Station (conta da ROCO). O ID no caminho identifica a
 * conta — não é segredo (vai no HTML público de qualquer forma), mas é
 * específico do cliente: um ID errado envia os leads para outra conta.
 *
 * Pode ser sobrescrito por `NEXT_PUBLIC_RDSTATION_SCRIPT_URL` sem editar
 * código (útil para apontar a um ambiente de teste do RD). Se a URL apontar
 * para um host fora do `script-src` da CSP, o navegador bloqueia o script —
 * então trocar o host exige mexer também em `next.config.ts`.
 */
const DEFAULT_SCRIPT_URL =
  "https://d335luupugsy2.cloudfront.net/js/loader-scripts/32842b26-669f-493a-9001-d7affeb51d9f-loader.js";

const SCRIPT_URL =
  process.env.NEXT_PUBLIC_RDSTATION_SCRIPT_URL?.trim() || DEFAULT_SCRIPT_URL;

/**
 * O tracking fica LIGADO por padrão em produção e DESLIGADO em
 * desenvolvimento — poluir o lead scoring do RD com navegação de
 * desenvolvedor é pior que não ter dado nenhum.
 *
 * `NEXT_PUBLIC_RDSTATION_TRACKING_ENABLED` sobrescreve nos dois sentidos:
 * `"false"` desliga em produção (interruptor de emergência, sem redeploy de
 * código), `"true"` liga em desenvolvimento (para conferir o script de fato
 * carregando).
 *
 * ⚠️ É `NEXT_PUBLIC_*`, portanto resolvida em BUILD-TIME e embutida no bundle:
 * mudar a env exige rebuild da imagem, não só reiniciar o container.
 */
function isEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_RDSTATION_TRACKING_ENABLED?.trim();
  if (flag === "true") return true;
  if (flag === "false") return false;
  return process.env.NODE_ENV === "production";
}

export function RdStationTracking() {
  if (!isEnabled()) return null;

  return (
    <Script
      id="rdstation-loader"
      src={SCRIPT_URL}
      strategy="afterInteractive"
    />
  );
}
