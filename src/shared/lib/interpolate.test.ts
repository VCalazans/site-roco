import { describe, expect, it } from "vitest";
import { interpolate } from "./interpolate";

describe("interpolate", () => {
  it("substitui um placeholder único", () => {
    expect(interpolate("{count} produtos encontrados", { count: 737 })).toBe(
      "737 produtos encontrados"
    );
  });

  it("substitui múltiplos placeholders distintos", () => {
    expect(
      interpolate("Página {page} de {totalPages}", { page: 2, totalPages: 37 })
    ).toBe("Página 2 de 37");
  });

  it("substitui todas as ocorrências do mesmo placeholder", () => {
    expect(interpolate("{x} + {x}", { x: 1 })).toBe("1 + 1");
  });

  it("aceita valores string e number", () => {
    expect(
      interpolate("{totalProducts}+ produtos em {totalCategories} categorias", {
        totalProducts: "737",
        totalCategories: 16,
      })
    ).toBe("737+ produtos em 16 categorias");
  });

  it("ignora placeholders sem valor correspondente", () => {
    expect(interpolate("{a} e {b}", { a: "x" })).toBe("x e {b}");
  });

  it("retorna o template intacto sem placeholders", () => {
    expect(interpolate("sem placeholder", { count: 1 })).toBe("sem placeholder");
  });
});
