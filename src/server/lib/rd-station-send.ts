import "server-only";

import { buildRdConversionPayload, type RdLeadInput } from "./rd-station";

/**
 * Envio da conversão à Conversions API do RD Station.
 *
 * A credencial é `RD_STATION_API_KEY` (painel do RD > Integrações > API Keys) e
 * viaja na QUERYSTRING — é o contrato deste endpoint, não há Bearer aqui.
 * Por isso a URL montada NUNCA é logada.
 *
 * ⚠️ A chave é de SERVIDOR. O envio existe como Route Handler justamente para
 * ela não ir ao navegador: um POST feito do cliente exporia a credencial no
 * código-fonte da página para qualquer visitante.
 */
const RD_CONVERSIONS_ENDPOINT = "https://api.rd.services/platform/conversions";

/** Teto de espera. O visitante não fica bloqueado por um terceiro lento. */
const REQUEST_TIMEOUT_MS = 8000;

export type RdSendResult = { ok: boolean; eventUuid?: string; error?: string };

export async function sendRdConversion(input: RdLeadInput): Promise<RdSendResult> {
  const apiKey = process.env.RD_STATION_API_KEY;
  if (!apiKey) {
    console.warn("[rd-station] RD_STATION_API_KEY ausente — conversão não enviada.");
    return { ok: false, error: "missing_api_key" };
  }

  const payload = buildRdConversionPayload(input);

  try {
    const response = await fetch(
      `${RD_CONVERSIONS_ENDPOINT}?api_key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      }
    );

    if (response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { event_uuid?: string }
        | null;
      return { ok: true, eventUuid: body?.event_uuid };
    }

    // Só o STATUS vai ao log — o corpo do erro do RD pode ecoar os dados
    // enviados, que incluem e-mail e telefone do visitante.
    console.error(`[rd-station] Conversão rejeitada (HTTP ${response.status}).`);
    return { ok: false, error: `http_${response.status}` };
  } catch (error) {
    const reason = error instanceof Error ? error.name : "unknown";
    console.error(`[rd-station] Falha de rede ao enviar conversão (${reason}).`);
    return { ok: false, error: "network" };
  }
}
