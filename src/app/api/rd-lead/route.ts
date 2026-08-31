import { NextResponse } from "next/server";
import { parseRdLeadInput } from "@/server/lib/rd-station";
import { sendRdConversion } from "@/server/lib/rd-station-send";

/**
 * `POST /api/rd-lead` — encaminha ao RD Station um lead que o formulário do
 * Mautic acabou de aceitar.
 *
 * POR QUE ESTA ROTA EXISTE: a `RD_STATION_API_KEY` é credencial de servidor. Um
 * POST feito direto do navegador para a API do RD a exporia no código-fonte da
 * página. Este handler é a única forma de o envio sair "direto ao RD" sem
 * publicar a chave.
 *
 * COMPLEMENTA o Mautic, não o substitui: o formulário segue postando para o
 * Mautic normalmente, e este encaminhamento acontece DEPOIS que aquele envio
 * deu certo (ver `use-rd-lead-forward`). Assim o RD passa a receber os leads
 * sem que uma indisponibilidade dele derrube a captação — que continua tendo o
 * Mautic como rede de segurança. Esta landing não tem banco, então não há aqui
 * o "grava primeiro, envia depois" do site novo; o Mautic faz esse papel.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Rate limit em MEMÓRIA — janela fixa por IP.
 *
 * O site novo usa Redis; esta landing não tem nenhum, e a alternativa seria não
 * ter limite algum numa rota pública que cria contato no CRM (spam de leads
 * falsos direto na base comercial). Em memória basta aqui: é um container só, e
 * o processo reiniciar apenas zera os contadores — falha para o lado permissivo,
 * que é o certo quando a consequência de um falso positivo é perder lead real.
 */
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
/** Teto de chaves — impede que IPs rotativos façam a Map crescer sem limite. */
const RATE_LIMIT_MAX_KEYS = 5000;

const hits = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);

  if (!entry || entry.resetAt <= now) {
    if (hits.size >= RATE_LIMIT_MAX_KEYS) {
      for (const [key, value] of hits) if (value.resetAt <= now) hits.delete(key);
      if (hits.size >= RATE_LIMIT_MAX_KEYS) return true;
    }
    hits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

/** Teto de corpo — a rota nunca bufferiza um payload grande antes de validar. */
const MAX_BODY_BYTES = 32 * 1024;

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(request: Request) {
  if (isRateLimited(getClientIp(request))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  const text = await request.text().catch(() => null);
  if (text === null || text.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // Honeypot: campo invisível no formulário. Preenchido = bot. Responde
  // sucesso de propósito, para o bot não aprender que foi detectado.
  if (typeof body === "object" && body !== null && (body as { website?: unknown }).website) {
    return NextResponse.json({ ok: true }, { status: 202 });
  }

  const input = parseRdLeadInput(body);
  if (!input) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  const result = await sendRdConversion(input);

  // 202 mesmo quando o RD recusa: o lead JÁ está no Mautic, e o visitante não
  // deve ver erro por causa de um canal secundário. O motivo fica no log.
  return NextResponse.json({ ok: result.ok }, { status: 202 });
}
