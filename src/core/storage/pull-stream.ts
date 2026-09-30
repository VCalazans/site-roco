import type { Readable } from "node:stream";

/**
 * Converte um stream do Node em ReadableStream lido SOB DEMANDA: cada `pull`
 * pede um pedaço ao iterador do stream do Node, e cancelar destrói o stream
 * (o que libera a conexão com o R2).
 *
 * Por que não `transformToWebStream()` (= `Readable.toWeb()`): aquele adaptador
 * empurra os dados por evento `data`. Cancelado com uma leitura já agendada —
 * um download de ZIP interrompido —, o evento seguinte faz `enqueue` num
 * controller fechado e a exceção escapa sem captura
 * (`ERR_INVALID_STATE: Controller is already closed`). Visto em 2026-09-30 com
 * o `ChecksumStream` que o SDK põe no corpo dos objetos gravados com checksum.
 * Aqui só se enfileira dentro do `pull`: erro depois do cancelamento vira
 * rejeição do próprio `pull`, que o stream já trata.
 */
export function toPullStream(source: Readable): ReadableStream<Uint8Array> {
  const chunks: AsyncIterator<Uint8Array> = source[Symbol.asyncIterator]();
  return new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        const { value, done } = await chunks.next();
        if (done) controller.close();
        else controller.enqueue(value);
      },
      cancel() {
        source.destroy();
      },
    },
    // Nada é lido antes de alguém pedir: a memória não cresce com o objeto.
    { highWaterMark: 0 }
  );
}
