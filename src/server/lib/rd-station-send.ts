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
import {
  classifyRdStationValidationError,
  hasCustomFields,
  stripCustomFields,
  type RdStationConversionPayload,
} from "./rd-station";

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
 *
 * DEGRADAÇÃO GRACIOSA (2026-08-25): um campo customizado que ainda não
 * existe no painel do RD faz a API responder 400 e a conversão INTEIRA se
 * perde — não só aquele campo. Como `cf_cnpj`, `cf_produto_interesse` e
 * `cf_origem` são criados À MÃO pelo stakeholder, esquecer um deles
 * derrubaria TODOS os leads. Então, num 400 que aparente ser de campo
 * (ou que não dê para classificar), tentamos UMA vez mais com apenas os
 * campos padrão. O desfecho fica distinguível em
 * `contact_submissions.rd_station_error` (`validation_retry_ok` /
 * `validation_retry_failed`), para o time saber que o painel precisa de
 * ajuste mesmo com o lead tendo chegado.
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

  const first = await postConversion(payload, apiKey);

  if (first.kind === "ok") {
    return { ok: true, eventUuid: first.eventUuid };
  }

  if (first.kind === "validation") {
    const classification = classifyRdStationValidationError(first.body);
    console.error(
      `[rd-station] Conversão rejeitada (400, classificação: ${classification}).`,
      first.body
    );

    // "other" = o RD apontou um problema que NÃO é de campo customizado
    // (e-mail inválido, telefone ausente...) — reenviar sem os `cf_*` daria
    // no mesmo 400, então não insistimos.
    if (classification === "other" || !hasCustomFields(payload)) {
      return { ok: false, error: "validation" };
    }

    const retry = await postConversion(stripCustomFields(payload), apiKey);
    if (retry.kind === "ok") {
      console.error(
        "[rd-station] Conversão aceita SEM os campos customizados — crie cf_cnpj/cf_produto_interesse/cf_origem no painel do RD Station (ver .env.example)."
      );
      return { ok: true, eventUuid: retry.eventUuid, error: "validation_retry_ok" };
    }

    console.error("[rd-station] Retry sem campos customizados também falhou.", retry.kind);
    return { ok: false, error: "validation_retry_failed" };
  }

  return { ok: false, error: first.error };
}

type PostOutcome =
  | { kind: "ok"; eventUuid?: string }
  | { kind: "validation"; body: unknown }
  | { kind: "failed"; error: string };

/**
 * Uma tentativa de POST. A API Key vai na QUERYSTRING (contrato da
 * Conversions API — não existe `Authorization: Bearer` para API Key neste
 * endpoint), por isso a URL montada NUNCA pode entrar em log.
 */
async function postConversion(
  payload: RdStationConversionPayload,
  apiKey: string
): Promise<PostOutcome> {
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
      return { kind: "ok", eventUuid: body?.event_uuid };
    }

    if (response.status === 400) {
      // O corpo traz `errors` (array OU objeto, conforme a página da doc)
      // explicando qual campo o RD rejeitou — é o insumo do retry.
      const body = await response.json().catch(() => null);
      return { kind: "validation", body };
    }

    if (response.status === 429) {
      // Diagnóstico distinto de "rede fora": o RD devolve teto e tempo de
      // espera no corpo. Irrelevante no volume da ROCO, mas colapsar isso em
      // "network" mandaria o time investigar a coisa errada.
      console.error("[rd-station] Rate limit da Conversions API (429).");
      return { kind: "failed", error: "rate_limited" };
    }

    console.error(`[rd-station] Resposta inesperada da Conversions API: ${response.status}`);
    return { kind: "failed", error: "network" };
  } catch (error) {
    console.error("[rd-station] Falha ao enviar conversão.", error);
    return { kind: "failed", error: "network" };
  }
}
