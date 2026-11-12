/**
 * Envio do evento à API de Conversões da Meta (I/O). NUNCA lança: o lead já
 * foi gravado antes; o resultado só vai para `contact_submissions.meta_capi_*`.
 *
 * Configuração (runtime, nunca `NEXT_PUBLIC_*`):
 * - `META_CAPI_ACCESS_TOKEN`: token gerado no Gerenciador de Eventos (segredo).
 * - `META_DATASET_ID`: conjunto de dados; sem ele vale `NEXT_PUBLIC_META_PIXEL_ID`.
 * - `META_CAPI_TEST_EVENT_CODE`: só para testar no painel "Eventos de teste".
 * - `META_GRAPH_API_VERSION`: padrão `v23.0`.
 * Sem token ou conjunto, devolve `skipped` sem barulho (pendência de configuração).
 */
import "server-only";
import type { MetaCapiEvent } from "./meta-capi";

export type MetaCapiSendResult = { status: "sent" | "failed" | "skipped"; error?: string };

const META_TIMEOUT_MS = 8_000;
const DEFAULT_GRAPH_VERSION = "v23.0";

function config() {
  const token = process.env.META_CAPI_ACCESS_TOKEN?.trim();
  const datasetId = (process.env.META_DATASET_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID)?.trim();
  const versionRaw = process.env.META_GRAPH_API_VERSION?.trim();
  const version = versionRaw && /^v\d{1,3}\.\d$/.test(versionRaw) ? versionRaw : DEFAULT_GRAPH_VERSION;
  const testCode = process.env.META_CAPI_TEST_EVENT_CODE?.trim() || undefined;
  if (!token || !datasetId || !/^\d{5,20}$/.test(datasetId)) return null;
  return { token, datasetId, version, testCode };
}

export function isMetaCapiConfigured(): boolean {
  return config() !== null;
}

export async function sendMetaCapiEvent(event: MetaCapiEvent): Promise<MetaCapiSendResult> {
  const cfg = config();
  if (!cfg) return { status: "skipped", error: "not_configured" };

  try {
    const response = await fetch(`https://graph.facebook.com/${cfg.version}/${cfg.datasetId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Token no CORPO, não na URL: URL acaba em log de proxy.
      body: JSON.stringify({
        data: [event],
        access_token: cfg.token,
        ...(cfg.testCode ? { test_event_code: cfg.testCode } : {}),
      }),
      signal: AbortSignal.timeout(META_TIMEOUT_MS),
      cache: "no-store",
    });

    if (response.ok) return { status: "sent" };

    const body = (await response.json().catch(() => null)) as
      | { error?: { message?: string; code?: number; error_subcode?: number } }
      | null;
    const detail = body?.error
      ? `${body.error.code ?? ""}/${body.error.error_subcode ?? ""} ${body.error.message ?? ""}`.trim()
      : "";
    const error = `http_${response.status}${detail ? ` ${detail}` : ""}`.slice(0, 300);
    console.warn(`[meta-capi] Evento recusado: ${error}`);
    return { status: "failed", error };
  } catch (error) {
    const name = error instanceof Error ? error.name : "unknown";
    console.warn(`[meta-capi] Falha ao enviar evento: ${name}`);
    return { status: "failed", error: name === "TimeoutError" ? "timeout" : "network" };
  }
}
