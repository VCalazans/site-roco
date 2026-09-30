import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { products } from "@/db/schema/catalog";
import { MAX_SEARCH_TERMS, containsPattern, matchAllTerms, splitSearchTerms, stripControlChars } from "./sql-like";

const dialect = new PgDialect();

function render(search: string, columns = [products.sku, products.namePt]) {
  const condition = matchAllTerms(search, columns);
  return condition ? dialect.sqlToQuery(condition) : undefined;
}

/**
 * Spec 001: busca "todas as palavras, sem acento/caixa". Renderiza o SQL de
 * verdade (dialeto Postgres do Drizzle) para garantir que o termo do usuário
 * vai SEMPRE como parâmetro — nunca interpolado no texto do SQL.
 */
describe("matchAllTerms", () => {
  it("undefined sem termo ou sem colunas", () => {
    expect(matchAllTerms("", [products.sku])).toBeUndefined();
    expect(matchAllTerms("   ", [products.sku])).toBeUndefined();
    expect(matchAllTerms("gas", [])).toBeUndefined();
  });

  it("um LIKE parametrizado por termo × coluna, termos dobrados (acento/caixa)", () => {
    const query = render("Flexível GÁS")!;
    const likeCount = query.sql.match(/ like \$/g)?.length ?? 0;
    expect(likeCount).toBe(4); // 2 termos × 2 colunas
    expect(query.params).toEqual(expect.arrayContaining(["%flexivel%", "%gas%"]));
    expect(query.sql).toContain(" and ");
    expect(query.sql).toContain(" or ");
  });

  it("dobra a COLUNA com translate(lower(...)) do mesmo mapa de acentos", () => {
    const query = render("gas", [products.namePt])!;
    expect(query.sql).toMatch(/translate\(lower\(coalesce\("products"\."name_pt", ''\)\), \$\d+, \$\d+\) like \$\d+/);
  });

  it("escapa metacaracteres do LIKE nos parâmetros", () => {
    const query = render("50%_x", [products.sku])!;
    expect(query.params).toContain("%50\\%\\_x%");
  });

  it("nunca interpola o texto do usuário no SQL", () => {
    const query = render("'; drop table products; --", [products.sku])!;
    expect(query.sql).not.toContain("drop table");
    expect(query.params.some((param) => String(param).includes("drop"))).toBe(true);
  });

  it("NUL e demais caracteres de controle nunca chegam ao banco (Postgres 22021 → 500)", () => {
    expect(stripControlChars("a\u0000b\u001fc\u007fd")).toBe("a b c d");
    expect(splitSearchTerms("\u0000")).toEqual([]);
    expect(splitSearchTerms("flex\u0000gas")).toEqual(["flex", "gas"]);
    expect(matchAllTerms("\u0000", [products.sku])).toBeUndefined();
    expect(containsPattern("ana\u0000")).toBe("%ana%");
    const query = render("a\u0000b", [products.sku])!;
    expect(query.params.some((param) => String(param).includes("\u0000"))).toBe(false);
  });

  it(`respeita o teto de ${MAX_SEARCH_TERMS} palavras`, () => {
    const query = render("a b c d e f g h i", [products.sku])!;
    const likeCount = query.sql.match(/ like \$/g)?.length ?? 0;
    expect(likeCount).toBe(MAX_SEARCH_TERMS);
  });
});
