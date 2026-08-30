/**
 * Teto de tamanho de corpo para Route Handlers.
 *
 * Route Handlers do Next NÃO têm limite de corpo (diferente das API Routes
 * do Pages Router, que tinham `bodyParser.sizeLimit` de 1 MB). `await
 * request.json()` bufferiza e parseia o corpo INTEIRO na memória do
 * processo antes de qualquer validação de schema — então o limite precisa
 * ser cobrado ANTES dessa chamada, não depois.
 *
 * Sem `server-only`: só lógica pura + leitura de `ReadableStream` padrão,
 * o que mantém o módulo testável no ambiente `node` do Vitest sem stub.
 */

/** Resultado da checagem do header `Content-Length`, antes de ler o corpo. */
export type ContentLengthVerdict =
  /** Header presente, numérico e dentro do teto. */
  | { kind: "within-limit"; bytes: number }
  /** Header ausente ou vazio — tamanho só é conhecido lendo o corpo. */
  | { kind: "unknown" }
  /** Header presente e acima do teto: recusar sem parsear. */
  | { kind: "too-large"; bytes: number }
  /** Header presente mas não é um inteiro não-negativo: cliente quebrado. */
  | { kind: "malformed" };

/**
 * Decide, SÓ pelo header, se vale a pena ler o corpo.
 *
 * Casos de borda e por que cada um responde assim:
 *
 * - **Ausente/vazio** → `unknown`, NÃO é liberação. `Content-Length` some
 *   legitimamente em `Transfer-Encoding: chunked` (é o que o `fetch` faz
 *   quando o corpo é um stream), então recusar de cara quebraria um
 *   cliente correto. Quem chama trata o `unknown` lendo o corpo com
 *   contador de bytes (ver `readBodyTextWithLimit`), que é a proteção de
 *   memória de verdade.
 * - **Não numérico** → `malformed`. Inclui o caso de header DUPLICADO:
 *   `Headers.get()` junta valores repetidos em `"10, 20"`, e dois
 *   `Content-Length` diferentes na mesma requisição é assinatura clássica
 *   de request smuggling — recusar é o certo. Também cai aqui `-1`, `1.5`,
 *   `1e6`, `0x10` e espaço no meio.
 * - **Acima do teto** → `too-large`, e quem chama responde 413 sem tocar
 *   no corpo: nenhum byte é bufferizado.
 *
 * O header é uma DICA barata (o cliente pode mentir); ele evita o trabalho
 * no caso honesto. A garantia real continua sendo o contador na leitura.
 */
export function checkContentLength(
  header: string | null,
  maxBytes: number
): ContentLengthVerdict {
  if (header === null) {
    return { kind: "unknown" };
  }

  const raw = header.trim();
  if (raw.length === 0) {
    return { kind: "unknown" };
  }

  // Estritamente dígitos: recusa sinal, ponto, notação científica, hexa,
  // espaço interno e a vírgula do header duplicado.
  if (!/^\d+$/.test(raw)) {
    return { kind: "malformed" };
  }

  const bytes = Number(raw);
  if (!Number.isFinite(bytes)) {
    return { kind: "malformed" };
  }

  if (bytes > maxBytes) {
    return { kind: "too-large", bytes };
  }

  return { kind: "within-limit", bytes };
}

/** Corpo lido por inteiro, ou recusa por ter passado do teto. */
export type LimitedBodyResult =
  | { ok: true; text: string }
  | { ok: false; reason: "too-large" };

/**
 * Lê o corpo como texto contando os bytes e abortando assim que passar do
 * teto — o processo nunca acumula mais que `maxBytes` na memória, mesmo se
 * o `Content-Length` mentiu ou nem veio.
 *
 * Sempre cancela o stream ao recusar, para não deixar o socket pendurado
 * drenando dados que serão jogados fora.
 */
export async function readBodyTextWithLimit(
  request: Request,
  maxBytes: number
): Promise<LimitedBodyResult> {
  const body = request.body;
  if (!body) {
    return { ok: true, text: "" };
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, reason: "too-large" };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return { ok: true, text: Buffer.concat(chunks).toString("utf8") };
}
