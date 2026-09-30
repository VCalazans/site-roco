import { describe, expect, it } from "vitest";
import { createDownloadSlots, type AcquireResult } from "./download-slots";

function acquired(result: AcquireResult) {
  if (!result.ok) throw new Error(`vaga recusada: ${result.reason}`);
  return result.slot;
}

describe("createDownloadSlots", () => {
  it("recusa acima do teto por usuário, sem afetar os outros", () => {
    const slots = createDownloadSlots({ perUser: 2, total: 5 });
    acquired(slots.tryAcquire("ana"));
    acquired(slots.tryAcquire("ana"));

    expect(slots.tryAcquire("ana")).toEqual({ ok: false, reason: "user" });
    expect(slots.tryAcquire("bia").ok).toBe(true);
  });

  it("recusa acima do teto total do processo", () => {
    const slots = createDownloadSlots({ perUser: 2, total: 3 });
    acquired(slots.tryAcquire("ana"));
    acquired(slots.tryAcquire("bia"));
    acquired(slots.tryAcquire("caio"));

    expect(slots.tryAcquire("davi")).toEqual({ ok: false, reason: "total" });
    expect(slots.inUse()).toBe(3);
  });

  it("devolver a vaga libera para o mesmo usuário e para o total", () => {
    const slots = createDownloadSlots({ perUser: 1, total: 1 });
    const first = acquired(slots.tryAcquire("ana"));
    expect(slots.tryAcquire("ana").ok).toBe(false);

    first.release();

    expect(slots.inUse()).toBe(0);
    expect(slots.tryAcquire("ana").ok).toBe(true);
  });

  it("devolver duas vezes não libera vaga que não existe", () => {
    const slots = createDownloadSlots({ perUser: 2, total: 2 });
    const first = acquired(slots.tryAcquire("ana"));
    acquired(slots.tryAcquire("ana"));

    first.release();
    first.release();

    expect(slots.inUse()).toBe(1);
    expect(slots.tryAcquire("ana").ok).toBe(true);
    expect(slots.tryAcquire("ana")).toEqual({ ok: false, reason: "user" });
  });
});
