import { describe, expect, it } from "vitest";
import { resolveCategoryCardHref } from "@/modules/home/lib/category-cards";

const SLUGS = ["conexoes", "gas", "flexiveis", "caixa-acoplada", "hidro-latao"];

describe("resolveCategoryCardHref", () => {
  it("prefixa o locale quando a categoria existe", () => {
    expect(
      resolveCategoryCardHref("/produtos?category=conexoes", "pt", SLUGS)
    ).toBe("/pt/produtos?category=conexoes");
  });

  it("mantém hrefs de busca sem validar (busca vazia é navegável)", () => {
    expect(
      resolveCategoryCardHref("/produtos?search=reparo", "en", SLUGS)
    ).toBe("/en/produtos?search=reparo");
  });

  it("degrada para a listagem completa quando a categoria não existe mais", () => {
    expect(
      resolveCategoryCardHref("/produtos?category=extinta", "pt", SLUGS)
    ).toBe("/pt/produtos");
  });

  it("mantém href sem query intacto", () => {
    expect(resolveCategoryCardHref("/produtos", "pt", SLUGS)).toBe(
      "/pt/produtos"
    );
  });

  it("decodifica o slug antes de validar", () => {
    expect(
      resolveCategoryCardHref(
        "/produtos?category=caixa%2Dacoplada",
        "pt",
        SLUGS
      )
    ).toBe("/pt/produtos?category=caixa%2Dacoplada");
  });

  it("valida category mesmo acompanhado de outros parâmetros", () => {
    expect(
      resolveCategoryCardHref("/produtos?page=2&category=extinta", "pt", SLUGS)
    ).toBe("/pt/produtos");
  });

  it("degrada (sem lançar) com percent-encoding malformado", () => {
    expect(
      resolveCategoryCardHref("/produtos?category=50%", "pt", SLUGS)
    ).toBe("/pt/produtos");
  });
});
