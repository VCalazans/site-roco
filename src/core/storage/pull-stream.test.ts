import { PassThrough, Readable } from "node:stream";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { toPullStream } from "./pull-stream";

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

/** Exceções que escapariam sem captura — o defeito que este adaptador evita. */
const strayErrors: unknown[] = [];
const collect = (error: unknown) => {
  strayErrors.push(error);
};

beforeAll(() => {
  process.on("uncaughtException", collect);
  process.on("unhandledRejection", collect);
});

afterAll(() => {
  process.off("uncaughtException", collect);
  process.off("unhandledRejection", collect);
});

afterEach(() => {
  strayErrors.length = 0;
});

describe("toPullStream", () => {
  it("entrega todos os pedaços, na ordem, e fecha no fim", async () => {
    const source = Readable.from([Buffer.from("abc"), Buffer.from("def")]);

    expect(await new Response(toPullStream(source)).text()).toBe("abcdef");
  });

  it("não lê nada do stream do Node antes de alguém pedir", async () => {
    const source = new PassThrough();
    source.write("guardado");

    const reader = toPullStream(source).getReader();
    await tick();
    expect(source.readableLength).toBe("guardado".length);

    const { value } = await reader.read();
    expect(new TextDecoder().decode(value)).toBe("guardado");
  });

  it("cancelar destrói o stream do Node — a conexão com o R2 é liberada", async () => {
    const source = new PassThrough();
    source.write("a");
    const reader = toPullStream(source).getReader();

    await reader.read();
    await reader.cancel(new Error("download interrompido"));

    expect(source.destroyed).toBe(true);
  });

  it("cancelar com leitura em andamento e dado chegando depois não solta exceção", async () => {
    const source = new PassThrough();
    const reader = toPullStream(source).getReader();

    const pending = reader.read();
    source.write("chegou junto com o cancelamento");
    await reader.cancel(new Error("download interrompido"));
    await tick();

    await expect(pending).resolves.toEqual({ done: true, value: undefined });
    expect(source.destroyed).toBe(true);
    expect(strayErrors).toEqual([]);
  });

  it("stream do Node que falha no meio vira erro na leitura, sem exceção solta", async () => {
    const source = new PassThrough();
    const reader = toPullStream(source).getReader();
    source.write("a");
    await reader.read();

    source.destroy(new Error("ECONNRESET"));

    await expect(reader.read()).rejects.toThrow("ECONNRESET");
    await tick();
    expect(strayErrors).toEqual([]);
  });
});
