import { describe, expect, it } from "vitest";
import {
  EMPTY_PRODUCT_FILTERS,
  applyProductFilters,
  buildProductsHref,
  hasActiveProductFilters,
  parseProductFilters,
  toProductListInput,
  toggleQuickFilter,
} from "./product-filters";

const CATEGORY = "3f2b8a52-6f86-4d2e-9d0b-0d0f2c3a9b11";

function parse(query: string) {
  return parseProductFilters(new URLSearchParams(query));
}

describe("parseProductFilters", () => {
  it("devolve o padrão para uma URL sem filtros", () => {
    expect(parse("")).toEqual(EMPTY_PRODUCT_FILTERS);
  });

  it("lê busca, categoria, status e filtros rápidos", () => {
    expect(
      parse(`search=joelho&category=${CATEGORY}&status=published&filter=featured&filter=noImage`)
    ).toEqual({
      search: "joelho",
      categoryId: CATEGORY,
      status: "published",
      quick: ["featured", "noImage"],
    });
  });

  it("aceita filtros rápidos separados por vírgula e devolve na ordem canônica", () => {
    expect(parse("filter=noImage,bestSeller").quick).toEqual(["bestSeller", "noImage"]);
  });

  it("descarta filtro rápido, status e categoria inválidos", () => {
    const filters = parse("filter=hacked&status=deleted&category=not-a-uuid");
    expect(filters.quick).toEqual([]);
    expect(filters.status).toBe("all");
    expect(filters.categoryId).toBe("");
  });

  it("apara a busca e respeita o teto do servidor", () => {
    expect(parse("search=%20%20luva%20%20").search).toBe("luva");
    expect(parse(`search=${"a".repeat(500)}`).search).toHaveLength(200);
  });

  it("decodifica termos com acento e espaço", () => {
    expect(parse(`search=${encodeURIComponent("válvula de gás")}`).search).toBe("válvula de gás");
  });
});

describe("applyProductFilters", () => {
  it("escreve só o que foge do padrão", () => {
    const params = applyProductFilters(new URLSearchParams(), {
      ...EMPTY_PRODUCT_FILTERS,
      status: "unpublished",
    });
    expect(params.toString()).toBe("status=unpublished");
  });

  it("reescreve os parâmetros de filtro e preserva os demais", () => {
    const base = new URLSearchParams(`search=antigo&filter=featured&new=1&utm=x`);
    const next = applyProductFilters(base, {
      search: "novo",
      categoryId: "",
      status: "all",
      quick: ["bestSeller"],
    });
    expect(next.get("search")).toBe("novo");
    expect(next.getAll("filter")).toEqual(["bestSeller"]);
    expect(next.get("new")).toBe("1");
    expect(next.get("utm")).toBe("x");
  });

  it("filtro novo volta à página 1, mas mantém o tamanho da página", () => {
    const base = new URLSearchParams("search=a&page=5&perPage=50");
    const next = applyProductFilters(base, { ...EMPTY_PRODUCT_FILTERS, search: "b" });
    expect(next.get("page")).toBeNull();
    expect(next.get("perPage")).toBe("50");
  });

  it("não muta o URLSearchParams recebido", () => {
    const base = new URLSearchParams("search=a");
    applyProductFilters(base, { ...EMPTY_PRODUCT_FILTERS, search: "b" });
    expect(base.get("search")).toBe("a");
  });

  it("faz ida e volta sem perda", () => {
    const filters = {
      search: "válvula & gás",
      categoryId: CATEGORY,
      status: "published" as const,
      quick: ["featured", "bestSeller", "noImage"] as const,
    };
    const params = applyProductFilters(new URLSearchParams(), { ...filters, quick: [...filters.quick] });
    expect(parseProductFilters(params)).toEqual({ ...filters, quick: [...filters.quick] });
  });
});

describe("toggleQuickFilter", () => {
  it("liga e desliga mantendo a ordem canônica", () => {
    let filters = toggleQuickFilter(EMPTY_PRODUCT_FILTERS, "noImage");
    filters = toggleQuickFilter(filters, "featured");
    expect(filters.quick).toEqual(["featured", "noImage"]);
    filters = toggleQuickFilter(filters, "featured");
    expect(filters.quick).toEqual(["noImage"]);
  });
});

describe("hasActiveProductFilters", () => {
  it("é falso no padrão e verdadeiro com qualquer filtro", () => {
    expect(hasActiveProductFilters(EMPTY_PRODUCT_FILTERS)).toBe(false);
    expect(hasActiveProductFilters({ ...EMPTY_PRODUCT_FILTERS, search: "x" })).toBe(true);
    expect(hasActiveProductFilters({ ...EMPTY_PRODUCT_FILTERS, status: "published" })).toBe(true);
    expect(hasActiveProductFilters({ ...EMPTY_PRODUCT_FILTERS, quick: ["noImage"] })).toBe(true);
    expect(hasActiveProductFilters({ ...EMPTY_PRODUCT_FILTERS, categoryId: CATEGORY })).toBe(true);
  });
});

describe("toProductListInput", () => {
  it("não manda chaves quando não há filtro", () => {
    expect(toProductListInput(EMPTY_PRODUCT_FILTERS)).toEqual({
      search: undefined,
      categoryId: undefined,
      published: undefined,
      featured: undefined,
      bestSeller: undefined,
      hasSiteImage: undefined,
    });
  });

  it("mapeia status e filtros rápidos para o contrato do router", () => {
    expect(
      toProductListInput({
        search: "luva",
        categoryId: CATEGORY,
        status: "unpublished",
        quick: ["featured", "bestSeller", "noImage"],
      })
    ).toEqual({
      search: "luva",
      categoryId: CATEGORY,
      published: false,
      featured: true,
      bestSeller: true,
      hasSiteImage: false,
    });
  });

  it("'sem foto' vira hasSiteImage:false (sem imagem no site), nunca true", () => {
    expect(toProductListInput({ ...EMPTY_PRODUCT_FILTERS, quick: ["noImage"] }).hasSiteImage).toBe(false);
    expect(toProductListInput(EMPTY_PRODUCT_FILTERS).hasSiteImage).toBeUndefined();
  });
});

describe("buildProductsHref", () => {
  const base = "/pt/portal/produtos";

  it("devolve o caminho puro sem filtros", () => {
    expect(buildProductsHref(base)).toBe(base);
  });

  it("monta os links dos indicadores do painel", () => {
    expect(buildProductsHref(base, { status: "published", quick: ["noImage"] })).toBe(
      `${base}?status=published&filter=noImage`
    );
    expect(buildProductsHref(base, { quick: ["featured"] })).toBe(`${base}?filter=featured`);
  });

  it("abre o diálogo de novo produto", () => {
    expect(buildProductsHref(base, {}, { openNew: true })).toBe(`${base}?new=1`);
  });
});
