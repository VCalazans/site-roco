"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Tracking de visitantes via Mautic (`mtc.js`).
 *
 * Equivale ao snippet oficial do Mautic, adaptado ao App Router:
 *
 *     (function(w,d,t,u,n,a,m){ … })(window,document,'script',
 *       'https://mautic.roco.com.br/mtc.js','mt');
 *     mt('send','pageview');
 *
 * Duas diferenças deliberadas em relação ao snippet:
 *
 * 1. SEGURANÇA — o script NÃO é carregado de `mautic.roco.com.br`. Depois do
 *    incidente ClickFix (jul/2026), em que o servidor Mautic servia JS malicioso,
 *    a CSP deste site fixou `script-src 'self'`. Aqui usamos uma cópia
 *    verificada e self-hosted (`/vendor/mautic-tracking.js`, ver
 *    `public/vendor/README.md`) — mesmo padrão já adotado para o SDK do
 *    formulário. Só os *dados* do hit saem para o Mautic (POST em `/mtc/event`,
 *    com fallback para o pixel `mtracking.gif`), cobertos por `connect-src` e
 *    `img-src`. Uma reinfecção do servidor Mautic não consegue executar script
 *    nesta origem.
 *
 *    Nota de auditoria: o `mtc.js` contém dois caminhos que injetariam script
 *    remoto (jQuery/froogaloop para *gated video*, e o SDK de formulário para
 *    *Dynamic Web Content*). Ambos são inertes aqui — o primeiro sai logo se a
 *    página não tem `<video>`, o segundo só roda ao renderizar um slot DWC.
 *    Nenhum dos dois existe neste site; se algum dia existir, a CSP bloqueia e
 *    o console acusa.
 *
 * 2. SPA — no App Router a navegação entre `/pt` e `/pt/catalogo` não recarrega
 *    a página, então o hit automático do `mtc.js` (disparado no load) contaria
 *    só a primeira visualização. O efeito abaixo emite um pageview a cada
 *    `pathname` novo.
 *
 * PRIVACIDADE/LGPD: o `mtc.js` grava cookies próprios (`mtc_id`, `mtc_sid`,
 * `mautic_device_id`) e `localStorage`, e cruza a visita com o contato do
 * Mautic — ou seja, identifica o visitante. Não há banner de consentimento
 * neste site; a flag `NEXT_PUBLIC_MAUTIC_TRACKING_ENABLED=false` desliga tudo
 * sem editar código, caso o jurídico exija opt-in.
 */

/** Cópia verificada e self-hosted do `mtc.js` (ver `public/vendor/README.md`). */
const TRACKING_SCRIPT_SRC = "/vendor/mautic-tracking.js";

/**
 * Nome da global usada como fila do Mautic (o `n` do snippet oficial). O
 * `mtc.js` lê `window.MauticTrackingObject` para descobrir onde está a fila.
 */
const TRACKING_OBJECT = "mt";

/**
 * Liga/desliga o tracking sem editar código.
 *   - produção: ligado, a menos que a flag seja exatamente `"false"`;
 *   - desenvolvimento: desligado, a menos que a flag seja exatamente `"true"`.
 *
 * O padrão de dev evita poluir as estatísticas e a atribuição de leads do
 * Mautic com acessos de `localhost`. `NEXT_PUBLIC_*` é embutido no build, então
 * mudar o valor exige rebuild.
 */
const TRACKING_ENABLED =
  process.env.NODE_ENV === "production"
    ? process.env.NEXT_PUBLIC_MAUTIC_TRACKING_ENABLED !== "false"
    : process.env.NEXT_PUBLIC_MAUTIC_TRACKING_ENABLED === "true";

type MauticQueueFn = {
  (...args: unknown[]): void;
  q?: unknown[][];
};

type MauticTrackingGlobal = Window & {
  MauticTrackingObject?: string;
  mt?: MauticQueueFn;
};

/**
 * Última rota já contabilizada. Deliberadamente em escopo de MÓDULO, não em
 * `useRef`: o estado que precisamos espelhar (o `mtc.js` já carregado, a fila
 * `mt`) vive no documento, não no componente. Assim a contagem continua correta
 * quando o componente remonta sem recarregar a página — o que acontece ao trocar
 * de locale, pois `[locale]/layout.tsx` é desmontado e montado de novo.
 * Como efeito colateral bem-vindo, também absorve a dupla invocação de efeitos
 * do StrictMode em desenvolvimento.
 */
let lastTrackedPath: string | null = null;

/** Garante que o script self-hosted entre no DOM uma única vez. */
function ensureScript() {
  if (document.querySelector(`script[src="${TRACKING_SCRIPT_SRC}"]`)) return;

  const script = document.createElement("script");
  script.src = TRACKING_SCRIPT_SRC;
  script.async = true;
  document.head.appendChild(script);
}

/**
 * Instala a fila `mt` (idempotente) e devolve a função de envio.
 *
 * Antes do `mtc.js` carregar, `mt(...)` só empilha em `mt.q`; o script drena a
 * fila no load. Depois de carregado, o próprio `mtc.js` substitui o `push` da
 * fila por uma versão que dispara `eventAddedToMauticQueue` — então a MESMA
 * chamada `mt('send','pageview')` passa a enviar o hit na hora. Por isso o
 * componente não precisa saber se o script já carregou: em qualquer ordem, cada
 * chamada resulta em exatamente um hit.
 */
function ensureQueue(w: MauticTrackingGlobal): MauticQueueFn {
  w.MauticTrackingObject = TRACKING_OBJECT;

  if (!w.mt) {
    const queue: MauticQueueFn = (...args: unknown[]) => {
      queue.q = queue.q || [];
      queue.q.push(args);
    };
    w.mt = queue;
  }

  return w.mt;
}

export function MauticTracking() {
  const pathname = usePathname();

  useEffect(() => {
    if (!TRACKING_ENABLED) return;
    if (lastTrackedPath === pathname) return;
    lastTrackedPath = pathname;

    const w = window as MauticTrackingGlobal;

    // `mtc.js` lê `document.title` e `location.href` no momento do envio — o
    // rAF dá ao Next a chance de commitar o título da nova rota antes do hit.
    // No primeiro carregamento o atraso é irrelevante: o hit fica na fila e o
    // `mtc.js` a drena ao carregar.
    let sent = false;
    const frame = requestAnimationFrame(() => {
      sent = true;
      ensureQueue(w)("send", "pageview");
    });

    ensureScript();

    return () => {
      cancelAnimationFrame(frame);
      // Se o quadro não chegou a rodar, o hit não saiu — devolve a rota à
      // condição de "não contabilizada" para que a próxima execução do efeito
      // a envie. Sem isso, a dupla invocação de efeitos do StrictMode
      // (cancela a 1ª, ignora a 2ª por já estar marcada) engoliria o pageview.
      if (!sent) lastTrackedPath = null;
    };
  }, [pathname]);

  return null;
}
