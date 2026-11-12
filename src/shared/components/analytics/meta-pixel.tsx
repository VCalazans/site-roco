"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { metaPixelId, trackMeta } from "@/shared/lib/meta-pixel";

/**
 * Meta Pixel (navegador). Liga só com `NEXT_PUBLIC_META_PIXEL_ID` (build-arg,
 * mudar exige rebuild); `NEXT_PUBLIC_META_PIXEL_ENABLED=false` desliga sem
 * tirar o ID. Montado só no layout `(site)`: o portal não tem rastreamento.
 *
 * O snippet oficial dispara o primeiro PageView; as trocas de página do App
 * Router não recarregam o documento, então cada `pathname` novo dispara mais
 * um (mesmo padrão do RD). `lastTrackedPath` em nível de módulo absorve a
 * dupla execução de efeitos do StrictMode.
 *
 * CSP: `connect.facebook.net` em `script-src`; `www.facebook.com` em `img-src`
 * e `connect-src` (`next.config.ts`).
 */
let lastTrackedPath: string | null = null;

function isEnabled(): boolean {
  return process.env.NEXT_PUBLIC_META_PIXEL_ENABLED?.trim() !== "false" && Boolean(metaPixelId());
}

export function MetaPixel() {
  const pathname = usePathname();
  const pixelId = metaPixelId();
  const enabled = isEnabled();

  useEffect(() => {
    if (!enabled || !pathname) return;
    if (lastTrackedPath === null) {
      lastTrackedPath = pathname; // o snippet já contou a primeira página
      return;
    }
    if (lastTrackedPath === pathname) return;
    lastTrackedPath = pathname;
    trackMeta("PageView");
  }, [enabled, pathname]);

  if (!enabled || !pixelId) return null;

  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');fbq('track','PageView');`}
    </Script>
  );
}
