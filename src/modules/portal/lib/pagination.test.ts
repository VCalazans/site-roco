import { describe, expect, it } from "vitest";
import {
  DEFAULT_PORTAL_PER_PAGE,
  applyPaging,
  clampPage,
  pageCountOf,
  parsePaging,
} from "./pagination";

describe("pageCountOf", () => {
  it("arredonda para cima e nunca devolve menos que 1", () => {
    expect(pageCountOf(737, 20)).toBe(37);
    expect(pageCountOf(40, 20)).toBe(2);
    expect(pageCountOf(0, 20)).toBe(1);
    expect(pageCountOf(Number.NaN, 20)).toBe(1);
    expect(pageCountOf(10, 0)).toBe(1);
  });
});

describe("clampPage", () => {
  it("mantém a página dentro do intervalo real", () => {
    expect(clampPage(999, 737, 20)).toBe(37);
    expect(clampPage(0, 737, 20)).toBe(1);
    expect(clampPage(-3, 737, 20)).toBe(1);
    expect(clampPage(2.9, 737, 20)).toBe(2);
    expect(clampPage(5, 0, 20)).toBe(1);
  });
});

describe("parsePaging", () => {
  it("lê página e tamanho válidos", () => {
    expect(parsePaging(new URLSearchParams("page=3&perPage=50"))).toEqual({ page: 3, perPage: 50 });
  });

  it("valores inválidos caem no padrão", () => {
    expect(parsePaging(new URLSearchParams("page=abc&perPage=7"))).toEqual({
      page: 1,
      perPage: DEFAULT_PORTAL_PER_PAGE,
    });
    expect(parsePaging(new URLSearchParams("page=-2"))).toEqual({ page: 1, perPage: DEFAULT_PORTAL_PER_PAGE });
    expect(parsePaging(new URLSearchParams("page=1.5"))).toEqual({ page: 1, perPage: DEFAULT_PORTAL_PER_PAGE });
    expect(parsePaging(new URLSearchParams(""))).toEqual({ page: 1, perPage: DEFAULT_PORTAL_PER_PAGE });
  });

  it("aceita outra lista de tamanhos", () => {
    expect(parsePaging(new URLSearchParams("perPage=10"), [10, 20], 10)).toEqual({ page: 1, perPage: 10 });
  });
});

describe("applyPaging", () => {
  it("omite os padrões e preserva os outros parâmetros", () => {
    const base = new URLSearchParams("search=joelho&page=4&perPage=50");
    expect(applyPaging(base, { page: 1, perPage: DEFAULT_PORTAL_PER_PAGE }).toString()).toBe("search=joelho");
    expect(applyPaging(base, { page: 2, perPage: 100 }).toString()).toBe("search=joelho&page=2&perPage=100");
  });

  it("não altera o objeto recebido", () => {
    const base = new URLSearchParams("page=4");
    applyPaging(base, { page: 1, perPage: DEFAULT_PORTAL_PER_PAGE });
    expect(base.toString()).toBe("page=4");
  });
});
