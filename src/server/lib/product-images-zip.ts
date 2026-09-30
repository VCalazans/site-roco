import "server-only";
import { makeZip } from "client-zip";
import { getObjectStream } from "@/core/storage/r2";
import { createDownloadSlots, type DownloadSlots } from "./download-slots";

export type ZipImageEntry = {
  /** Caminho dentro do ZIP, já saneado (ver `zip-entry-names`). */
  path: string;
  r2Key: string;
  lastModified: Date;
};

/** Texto que acompanha o ZIP quando alguma imagem não pôde ser lida. */
export type ZipFailureReport = { fileName: string; header: string };

/**
 * Quantos objetos do R2 ficam abertos À FRENTE do que está sendo gravado.
 * Cada GET espera ~0,3 s pelo primeiro byte; um por vez, o catálogo inteiro
 * (617 imagens, 336 MB) levava 340 s medidos, quase tudo de espera. Uma
 * janela pequena esconde essa latência sem soltar a memória: o corpo de um
 * objeto aberto só é lido quando chega a vez dele.
 */
export const PREFETCH_WINDOW = 4;

/**
 * Tetos de ZIPs simultâneos por processo. Cada ZIP ocupa até
 * `PREFETCH_WINDOW` conexões com o R2 enquanto não termina — e ocupa pelo
 * tempo que quem baixa quiser, se a rede dele for lenta. Sem teto, ~13 ZIPs
 * parados esgotavam os 50 sockets do cliente S3, que também atende upload,
 * confirmação e exclusão de arquivos no portal. 5 × 4 = 20: sobram 30.
 */
export const IMAGE_ZIP_LIMITS = { perUser: 2, total: 5 } as const;

declare global {
  var __rocoImageZipSlots: DownloadSlots | undefined;
}

/** Vagas de ZIP de imagens deste processo (sobrevive ao HMR do dev server). */
export function imageZipSlots(): DownloadSlots {
  globalThis.__rocoImageZipSlots ??= createDownloadSlots(IMAGE_ZIP_LIMITS);
  return globalThis.__rocoImageZipSlots;
}

/**
 * Tempo máximo sem progresso — nem leitura de quem baixa nem dado vindo do
 * R2. Passou disso, o download é encerrado e as conexões e a vaga voltam
 * para o processo (o SDK não tem timeout de requisição, e um navegador com o
 * download pausado seguraria tudo indefinidamente).
 */
export const ZIP_IDLE_TIMEOUT_MS = 2 * 60 * 1000;

/** Abre o objeto; falha vira `null` e a imagem é listada no relatório. */
async function openObject(r2Key: string): Promise<ReadableStream<Uint8Array> | null> {
  try {
    return await getObjectStream(r2Key);
  } catch (error) {
    console.error("[product-images-zip] Falha ao ler a imagem no R2.", r2Key, error);
    return null;
  }
}

/**
 * Repassa `source` e o cancela no R2 quando `signal` abortar — mesmo com o
 * leitor do client-zip preso ao stream devolvido. (`pipeThrough` com `signal`
 * não serve: pela especificação, o abort espera a escrita pendente terminar, e
 * ela nunca termina quando ninguém mais lê o outro lado.)
 */
function cancelOnAbort(source: ReadableStream<Uint8Array>, signal: AbortSignal): ReadableStream<Uint8Array> {
  const reader = source.getReader();
  const cancelSource = () => void reader.cancel(signal.reason).catch(() => undefined);
  const stopListening = () => signal.removeEventListener("abort", cancelSource);
  if (signal.aborted) cancelSource();
  else signal.addEventListener("abort", cancelSource, { once: true });

  return new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        try {
          const { value, done } = await reader.read();
          if (done) {
            stopListening();
            controller.close();
          } else {
            controller.enqueue(value);
          }
        } catch (error) {
          stopListening();
          controller.error(error);
        }
      },
      cancel(reason) {
        stopListening();
        return reader.cancel(reason);
      },
    },
    // Só lê do R2 quando o client-zip pede: nada acumula em memória.
    { highWaterMark: 0 }
  );
}

/** Entradas do ZIP, na ordem recebida, com a janela de objetos abertos à frente. */
async function* zipInputs(
  entries: readonly ZipImageEntry[],
  report: ZipFailureReport,
  signal: AbortSignal
) {
  const failed: string[] = [];
  // Mesma ordem de `entries`: o primeiro da fila é sempre o da vez.
  const opening: Promise<ReadableStream<Uint8Array> | null>[] = [];
  let nextToOpen = 0;

  try {
    for (const entry of entries) {
      while (nextToOpen < entries.length && opening.length < PREFETCH_WINDOW) {
        opening.push(openObject(entries[nextToOpen++].r2Key));
      }
      const object = await opening.shift();
      if (!object) {
        failed.push(entry.path);
        continue;
      }
      yield { name: entry.path, input: cancelOnAbort(object, signal), lastModified: entry.lastModified };
    }
  } finally {
    // Interrompido no meio: fecha o que já estava aberto à frente.
    for (const pending of opening) {
      void pending.then((stream) => stream?.cancel()).catch(() => undefined);
    }
  }

  if (failed.length > 0) {
    yield {
      name: report.fileName,
      input: `${report.header}\n\n${failed.join("\n")}\n`,
      lastModified: new Date(),
    };
  }
}

/**
 * ZIP com os bytes ORIGINAIS das imagens — o client-zip grava no modo "store",
 * sem recomprimir, então nada perde qualidade. É montado em fluxo e a memória
 * não cresce com o tamanho do download.
 *
 * Imagem que falhar ao abrir (objeto apagado do bucket, R2 instável) é pulada
 * e listada num arquivo de texto no fim do ZIP — perde-se aquela imagem, não
 * o download inteiro.
 *
 * Download interrompido (aba fechada, rede caiu — o Next cancela o stream),
 * que falhou no meio ou que ficou `idleTimeoutMs` sem progresso fecha as
 * conexões com o R2 na hora: o client-zip não encerra o gerador de entradas
 * sozinho, e cada conexão esquecida ocuparia uma vaga do pool do SDK até o R2
 * desistir dela. `onClose` roda UMA vez em qualquer desfecho (fim, erro,
 * cancelamento ou parada) — é onde a rota devolve a vaga do download.
 */
export function streamImagesZip(
  entries: readonly ZipImageEntry[],
  report: ZipFailureReport,
  options: { onClose?: () => void; idleTimeoutMs?: number } = {}
): ReadableStream<Uint8Array> {
  const idleTimeoutMs = options.idleTimeoutMs ?? ZIP_IDLE_TIMEOUT_MS;
  const abort = new AbortController();
  const inputs = zipInputs(entries, report, abort.signal);
  const zip = makeZip(inputs).getReader();
  let closed = false;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;

  function finish() {
    if (closed) return;
    closed = true;
    clearTimeout(idleTimer);
    options.onClose?.();
  }

  function release(reason: unknown) {
    if (!abort.signal.aborted) {
      abort.abort(reason);
      void inputs.return(undefined).catch(() => undefined);
    }
    finish();
  }

  /** (Re)arma o relógio de "sem progresso"; `unref` para nunca segurar o processo. */
  function armIdleTimer(controller: ReadableStreamDefaultController<Uint8Array>) {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      const error = new Error(
        `[product-images-zip] Download sem progresso há ${Math.round(idleTimeoutMs / 1000)} s — encerrado e conexões com o R2 liberadas.`
      );
      release(error);
      void zip.cancel(error).catch(() => undefined);
      controller.error(error);
    }, idleTimeoutMs);
    idleTimer.unref?.();
  }

  return new ReadableStream<Uint8Array>({
    start(controller) {
      armIdleTimer(controller);
    },
    async pull(controller) {
      armIdleTimer(controller);
      try {
        const { value, done } = await zip.read();
        if (done) {
          finish();
          controller.close();
          return;
        }
        controller.enqueue(value);
        armIdleTimer(controller);
      } catch (error) {
        release(error);
        controller.error(error);
      }
    },
    cancel(reason) {
      release(reason);
      void zip.cancel(reason).catch(() => undefined);
    },
  });
}
