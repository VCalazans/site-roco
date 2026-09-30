import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getObjectStreamMock = vi.fn<(key: string) => Promise<ReadableStream<Uint8Array>>>();

vi.mock("@/core/storage/r2", () => ({
  getObjectStream: (key: string) => getObjectStreamMock(key),
}));

import { PREFETCH_WINDOW, streamImagesZip, type ZipImageEntry } from "./product-images-zip";

const REPORT = { fileName: "LEIA-ME-falhas.txt", header: "Imagens que não puderam ser incluídas:" };
const CHUNKS_PER_OBJECT = 8;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Conteúdo único por chave: achado no ZIP, prova que os bytes foram copiados intactos. */
const contentOf = (key: string) => new TextEncoder().encode(`<<conteudo-original:${key}>>`.repeat(4));

type FakeBucket = {
  /** Quantos objetos já tinham sido abertos quando cada um começou a ser lido. */
  openedAtFirstRead: Map<string, number>;
  cancelled: string[];
  opened: () => number;
};

/**
 * R2 de mentira: cada objeto entrega o conteúdo em vários pedaços (para dar
 * tempo de cancelar no meio) e registra quando foi lido e se foi cancelado.
 */
function fakeBucket(options: { openDelayMs?: Record<string, number>; failOpen?: string[]; failMidway?: string[] } = {}): FakeBucket {
  let opened = 0;
  const openedAtFirstRead = new Map<string, number>();
  const cancelled: string[] = [];

  getObjectStreamMock.mockImplementation(async (key) => {
    opened += 1;
    await delay(options.openDelayMs?.[key] ?? 0);
    if (options.failOpen?.includes(key)) throw new Error(`NoSuchKey: ${key}`);

    const bytes = contentOf(key);
    const size = Math.ceil(bytes.length / CHUNKS_PER_OBJECT);
    let offset = 0;
    return new ReadableStream<Uint8Array>({
      pull(controller) {
        if (!openedAtFirstRead.has(key)) openedAtFirstRead.set(key, opened);
        if (options.failMidway?.includes(key) && offset > 0) {
          controller.error(new Error(`ECONNRESET: ${key}`));
          return;
        }
        if (offset >= bytes.length) {
          controller.close();
          return;
        }
        controller.enqueue(bytes.slice(offset, offset + size));
        offset += size;
      },
      cancel() {
        cancelled.push(key);
      },
    });
  });

  return { openedAtFirstRead, cancelled, opened: () => opened };
}

function entries(keys: string[]): ZipImageEntry[] {
  return keys.map((key, index) => ({
    path: `produto/${String(index + 1).padStart(2, "0")}-${key}.png`,
    r2Key: key,
    lastModified: new Date("2026-09-30T12:00:00Z"),
  }));
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  return Buffer.from(await new Response(stream).arrayBuffer());
}

const keys = (count: number) => Array.from({ length: count }, (_, index) => `obj-${index}`);

beforeEach(() => {
  getObjectStreamMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("streamImagesZip", () => {
  it("grava cada imagem com os bytes originais, na ordem das entradas, mesmo se os objetos abrem fora de ordem", async () => {
    // O primeiro demora mais para abrir que os seguintes.
    fakeBucket({ openDelayMs: { a: 30, b: 0, c: 10 } });

    const zip = await readAll(streamImagesZip(entries(["a", "b", "c"]), REPORT));

    const positions = ["a", "b", "c"].map((key) => zip.indexOf(Buffer.from(contentOf(key))));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((x, y) => x - y));
    expect(zip.includes(Buffer.from("produto/01-a.png"))).toBe(true);
    expect(zip.includes(Buffer.from(REPORT.fileName))).toBe(false);
  });

  it("pula a imagem que não abre e a lista no relatório ao fim — sem perder as outras", async () => {
    fakeBucket({ failOpen: ["b"] });

    const zip = await readAll(streamImagesZip(entries(["a", "b", "c"]), REPORT));
    const has = (bytes: Uint8Array | string) => zip.includes(Buffer.from(bytes));

    expect(has(contentOf("a"))).toBe(true);
    expect(has(contentOf("c"))).toBe(true);
    expect(has(contentOf("b"))).toBe(false);
    expect(has(REPORT.fileName)).toBe(true);
    // O relatório vai em UTF-8 ("não", "incluídas"), gravado como veio.
    expect(has(`${REPORT.header}\n\nproduto/02-b.png\n`)).toBe(true);
  });

  it(`abre no máximo ${PREFETCH_WINDOW} objetos à frente do que está sendo gravado`, async () => {
    const bucket = fakeBucket();
    const all = keys(12);

    await readAll(streamImagesZip(entries(all), REPORT));

    expect(bucket.opened()).toBe(all.length);
    all.forEach((key, index) => {
      expect(bucket.openedAtFirstRead.get(key)).toBeLessThanOrEqual(index + PREFETCH_WINDOW);
    });
    // E de fato abre à frente — é o que esconde a latência do R2.
    expect(bucket.openedAtFirstRead.get("obj-0")).toBe(PREFETCH_WINDOW);
  });

  it("download cancelado fecha no R2 o arquivo da vez e os que já estavam abertos à frente", async () => {
    const bucket = fakeBucket();
    const reader = streamImagesZip(entries(keys(10)), REPORT).getReader();

    await reader.read();
    await reader.cancel(new Error("cliente desconectou"));
    await delay(20);

    expect(bucket.opened()).toBe(PREFETCH_WINDOW);
    expect([...bucket.cancelled].sort()).toEqual(keys(PREFETCH_WINDOW).sort());
  });

  it("onClose roda uma única vez — no fim do ZIP ou no cancelamento", async () => {
    fakeBucket();
    const finished = vi.fn();
    await readAll(streamImagesZip(entries(["a", "b"]), REPORT, { onClose: finished }));
    expect(finished).toHaveBeenCalledTimes(1);

    const cancelled = vi.fn();
    const reader = streamImagesZip(entries(keys(10)), REPORT, { onClose: cancelled }).getReader();
    await reader.read();
    await reader.cancel(new Error("cliente desconectou"));
    await reader.cancel(new Error("de novo")).catch(() => undefined);
    await delay(20);
    expect(cancelled).toHaveBeenCalledTimes(1);
  });

  it("parado sem leitura: encerra após o tempo sem progresso, fecha no R2 e devolve a vaga", async () => {
    const bucket = fakeBucket();
    const onClose = vi.fn();
    const reader = streamImagesZip(entries(keys(10)), REPORT, { onClose, idleTimeoutMs: 40 }).getReader();

    await reader.read();
    await delay(150);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(bucket.opened()).toBe(PREFETCH_WINDOW);
    expect([...bucket.cancelled].sort()).toEqual(keys(PREFETCH_WINDOW).sort());
    await expect(reader.read()).rejects.toThrow("sem progresso");
  });

  it("falha no meio de um arquivo interrompe o ZIP e fecha as conexões abertas à frente", async () => {
    const bucket = fakeBucket({ failMidway: ["obj-0"] });

    await expect(readAll(streamImagesZip(entries(keys(10)), REPORT))).rejects.toThrow("ECONNRESET");
    await delay(20);

    expect(bucket.opened()).toBe(PREFETCH_WINDOW);
    expect([...bucket.cancelled].sort()).toEqual(keys(PREFETCH_WINDOW).slice(1).sort());
  });
});
