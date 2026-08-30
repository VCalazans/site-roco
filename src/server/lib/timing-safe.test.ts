import { describe, expect, it } from "vitest";
import { timingSafeEqualString } from "./timing-safe";

describe("timingSafeEqualString", () => {
  it("aceita segredos idênticos", () => {
    expect(timingSafeEqualString("s3gr3d0-do-webhook", "s3gr3d0-do-webhook")).toBe(true);
  });

  it("recusa segredos diferentes de mesmo tamanho", () => {
    expect(timingSafeEqualString("abcdef", "abcdeg")).toBe(false);
  });

  it("recusa tamanhos diferentes SEM lançar (timingSafeEqual cru lançaria)", () => {
    expect(timingSafeEqualString("curto", "um-segredo-bem-mais-longo")).toBe(false);
    expect(timingSafeEqualString("um-segredo-bem-mais-longo", "curto")).toBe(false);
  });

  it("é sensível à caixa", () => {
    expect(timingSafeEqualString("Token", "token")).toBe(false);
  });

  it("não faz trim: espaço em volta é diferença real", () => {
    expect(timingSafeEqualString(" token", "token")).toBe(false);
  });

  it("lida com string vazia dos dois lados", () => {
    expect(timingSafeEqualString("", "")).toBe(true);
    expect(timingSafeEqualString("", "token")).toBe(false);
    expect(timingSafeEqualString("token", "")).toBe(false);
  });

  it("compara por BYTES, não por unidades UTF-16", () => {
    // "é" tem 1 char e 2 bytes: comprimentos em bytes é o que importa.
    expect(timingSafeEqualString("é", "é")).toBe(true);
    expect(timingSafeEqualString("é", "ab")).toBe(false);
  });
});
