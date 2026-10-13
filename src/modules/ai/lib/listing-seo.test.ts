import { describe, it, expect } from "vitest";
import { listingIndexing } from "./listing-seo";

const base = { searchTerms: [] as string[], categories: [] as string[], bestSeller: false, page: 1 };

describe("listingIndexing", () => {
  it("sem filtro: indexável, canonical sem querystring", () => {
    expect(listingIndexing(base)).toEqual({ index: true, query: "", category: null });
  });

  it("uma categoria: indexável, canonical com a categoria", () => {
    expect(listingIndexing({ ...base, categories: ["gas"] })).toEqual({
      index: true,
      query: "?category=gas",
      category: "gas",
    });
  });

  it("página 2 entra no canonical (sem categoria)", () => {
    expect(listingIndexing({ ...base, page: 2 })).toEqual({ index: true, query: "?page=2", category: null });
  });

  it("página 2 com categoria: categoria e página no canonical, nessa ordem", () => {
    expect(listingIndexing({ ...base, categories: ["gas"], page: 3 })).toEqual({
      index: true,
      query: "?category=gas&page=3",
      category: "gas",
    });
  });

  it("página 1 não gera parâmetro de página", () => {
    expect(listingIndexing({ ...base, page: 1 }).query).toBe("");
  });

  it("busca livre: noindex, canonical vazio", () => {
    expect(listingIndexing({ ...base, searchTerms: ["flexivel"] })).toEqual({ index: false, query: "", category: null });
  });

  it("várias categorias: noindex", () => {
    const result = listingIndexing({ ...base, categories: ["gas", "conexoes"] });
    expect(result.index).toBe(false);
    expect(result.category).toBeNull();
  });

  it("só campeões: noindex, mesmo sem outro filtro", () => {
    expect(listingIndexing({ ...base, bestSeller: true })).toEqual({ index: false, query: "", category: null });
  });

  it("slug com caractere especial é encodado no canonical", () => {
    expect(listingIndexing({ ...base, categories: ["gás & cia"] }).query).toBe("?category=g%C3%A1s%20%26%20cia");
    expect(listingIndexing({ ...base, categories: ["a b"] }).category).toBe("a b");
  });

  it("noindex vence a página: busca na página 2 continua noindex sem canonical", () => {
    expect(listingIndexing({ ...base, searchTerms: ["x"], page: 2 })).toEqual({
      index: false,
      query: "",
      category: null,
    });
  });
});
