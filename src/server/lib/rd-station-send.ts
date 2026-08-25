/**
 * Envio de verdade da conversão para o RD Station (I/O — `server-only`).
 * O payload puro é montado por `buildRdStationConversionPayload`
 * (`./rd-station.ts`). Separado em arquivo próprio para que o construtor de
 * payload continue importável em testes sem tocar rede.
 *
 * NUNCA lança: o caller (`POST /api/contact`) já gravou o lead no banco
 * antes de chamar isto, então uma falha aqui não pode derrubar a resposta ao
 * visitante — só fica registrada em `contact_submissions` para retry/
 * investigação manual.
 */
import "server-only";
import type { RdStationConversionPayload } from "./rd-station";

export type RdStationSendResult = { ok: boolean; eventUuid?: string; error?: string };

const RD_STATION_CONVERSIONS_URL = "https://api.rd.services/platform/conversions";
const RD_STATION_TIMEOUT_MS = 8_000;

/**
 * Lê `RD_STATION_API_KEY` em runtime (não em build-time — é segredo, nunca
 * `NEXT_PUBLIC_*`). Sem a env configurada, isto é uma PENDÊNCIA DE
 * CONFIGURAÇÃO, não um bug: loga em nível `info` e retorna `ok: false` sem
 * barulho — mesmo espírito do stub `RdStationTracking`
 * (`src/shared/components/analytics/rdstation-tracking.tsx`), que também
 * fica desligado até as credenciais existirem.
 */
export async function sendRdStationConversion(
  payload: RdStationConversionPayload
): Promise<RdStationSendResult> {
  const apiKey = process.env.RD_STATION_API_KEY;
  if (!apiKey) {
    console.info(
      "[rd-station] RD_STATION_API_KEY não configurada — conversão não enviada (pendência de configuração)."
    );
    return { ok: false, error: "missing_api_key" };
  }

  try {
    const response = await fetch(
      `${RD_STATION_CONVERSIONS_URL}?api_key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(RD_STATION_TIMEOUT_MS),
      }
    );

    if (response.ok) {
      const body = (await response.json().catch(() => null)) as { event_uuid?: string } | null;
      return { ok: true, eventUuid: body?.event_uuid };
    }

    if (response.status === 400) {
      // Log estruturado: é o principal sinal de diagnóstico se os campos
      // customizados (cf_cnpj, cf_produto_interesse) ainda não existirem no
      // painel do RD Station — o corpo traz o array `errors` explicando qual
      // campo o RD rejeitou.
      const body = (await response.json().catch(() => null)) as { errors?: unknown } | null;
      console.error("[rd-station] Conversão rejeitada (400).", body?.errors ?? body);
      return { ok: false, error: "validation" };
    }

    console.error(`[rd-station] Resposta inesperada da Conversions API: ${response.status}`);
    return { ok: false, error: "network" };
  } catch (error) {
    console.error("[rd-station] Falha ao enviar conversão.", error);
    return { ok: false, error: "network" };
  }
}
