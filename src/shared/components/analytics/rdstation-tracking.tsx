"use client";

import Script from "next/script";

/**
 * Tracking de visitantes via RD Station (substituto do Mautic).
 *
 * MIGRATION 2026-08-23: o `MauticTracking` saiu do site (decisão do
 * stakeholder — RD Station voltou como plataforma de marketing).
 * Este componente é o stub que carrega o script do RD Station sob
 * demanda — fica DESLIGADO por padrão até o jurídico confirmar a base
 * legal e o stakeholder fornecer as envs.
 *
 * Por padrão DESLIGADO:
 *   - dev: sempre desligado (não polui dados do lead scoring);
 *   - prod: ligado somente se `NEXT_PUBLIC_RDSTATION_TRACKING_ENABLED=true`.
 *
 * Ligar é opt-in por flag — sem edição de código. As URLs/scripts são
 * carregados de `NEXT_PUBLIC_RDSTATION_SCRIPT_URL` (CSP `script-src` deve
 * ser atualizada para o host quando o domínio for definido).
 */
const SCRIPT_URL = process.env.NEXT_PUBLIC_RDSTATION_SCRIPT_URL;

function isEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_RDSTATION_TRACKING_ENABLED;
  if (process.env.NODE_ENV !== "production") {
    return flag === "true";
  }
  return flag === "true";
}

export function RdStationTracking() {
  if (!isEnabled()) return null;
  if (!SCRIPT_URL) return null;
  return <Script src={SCRIPT_URL} strategy="afterInteractive" />;
}
