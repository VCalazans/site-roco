import { describe, expect, it } from "vitest";
import {
  MAX_CATEGORY_VALUES,
  MAX_SEARCH_CHIPS,
  MAX_SEARCH_LENGTH,
  MAX_SEARCH_VALUES,
  buildListingQuery,
  cleanTerm,
  commitSearchTerm,
  effectiveSearchTerms,
  matchesServerRender,
  normalizeCategorySlugs,
  normalizeSearchTerms,
  paramValues,
  parseBestSeller,
  readListingState,
  sameList,
  sortByOrder,
  termKey,
  toggleCategory,
} from "./listing-filters";

describe("termKey / cleanTerm", () => {
  it("compara sem acento, caixa ou espaços extras", () => {
    expect(termKey("  Gás  Natural ")).toBe("gas natural");
    expect(termKey("FLEXÍVEL")).toBe(termKey("flexivel"));
  });

  it("limpa o termo preservando a grafia", () => {
    expect(cleanTerm("  Engate   Flexível  ")).toBe("Engate Flexível");
    expect(cleanTerm("   ")).toBe("");
  });

  it(`corta o termo em ${MAX_SEARCH_LENGTH} caracteres, sem deixar espaço na ponta`, () => {
    const long = `${"a".repeat(MAX_SEARCH_LENGTH - 1)} b`;
    expect(cleanTerm(long)).toBe("a".repeat(MAX_SEARCH_LENGTH - 1));
    expect(cleanTerm("x".repeat(MAX_SEARCH_LENGTH + 20))).toHaveLength(MAX_SEARCH_LENGTH);
  });
});

describe("normalizeSearchTerms", () => {
  it("remove vazios e repetidos (ignorando acento e caixa), na ordem de chegada", () => {
    expect(normalizeSearchTerms(["engate", " ", "GÁS", "gas", "Engate", "40"])).toEqual(["engate", "GÁS", "40"]);
  });

  it(`aceita no máximo ${MAX_SEARCH_VALUES} termos (chips + o texto do campo)`, () => {
    const values = Array.from({ length: MAX_SEARCH_VALUES + 4 }, (_, index) => `termo${index}`);
    expect(normalizeSearchTerms(values)).toHaveLength(MAX_SEARCH_VALUES);
  });

  it("um valor só (link antigo, busca do header) vira um termo", () => {
    expect(normalizeSearchTerms(["flexivel gas"])).toEqual(["flexivel gas"]);
  });
});

describe("normalizeCategorySlugs", () => {
  it("remove vazios e repetidos", () => {
    expect(normalizeCategorySlugs(["gas", " conexoes ", "", "gas"])).toEqual(["gas", "conexoes"]);
  });

  it(`descarta o excedente de ${MAX_CATEGORY_VALUES} valores`, () => {
    const values = Array.from({ length: MAX_CATEGORY_VALUES * 3 }, (_, index) => `cat-${index}`);
    expect(normalizeCategorySlugs(values)).toHaveLength(MAX_CATEGORY_VALUES);
  });
});

describe("paramValues / parseBestSeller", () => {
  it("normaliza o valor de searchParams do App Router", () => {
    expect(paramValues(undefined)).toEqual([]);
    expect(paramValues("gas")).toEqual(["gas"]);
    expect(paramValues(["gas", "conexoes"])).toEqual(["gas", "conexoes"]);
  });

  it("só 1/true ligam o filtro de campeões", () => {
    expect(parseBestSeller("1")).toBe(true);
    expect(parseBestSeller("true")).toBe(true);
    expect(parseBestSeller("0")).toBe(false);
    expect(parseBestSeller("yes")).toBe(false);
    expect(parseBestSeller(null)).toBe(false);
    expect(parseBestSeller(undefined)).toBe(false);
  });
});

describe("commitSearchTerm (Enter no campo de busca)", () => {
  it("fixa o texto como mais um chip", () => {
    expect(commitSearchTerm(["engate"], "  40 cm ")).toEqual({ status: "added", terms: ["engate", "40 cm"] });
  });

  it("campo vazio não fixa nada", () => {
    expect(commitSearchTerm(["engate"], "   ")).toEqual({ status: "empty", terms: ["engate"] });
  });

  it("termo repetido só libera o campo (sem chip duplicado)", () => {
    expect(commitSearchTerm(["Gás"], "gas")).toEqual({ status: "duplicate", terms: ["Gás"] });
  });

  it(`respeita o teto de ${MAX_SEARCH_CHIPS} chips`, () => {
    const full = Array.from({ length: MAX_SEARCH_CHIPS }, (_, index) => `t${index}`);
    expect(commitSearchTerm(full, "outro")).toEqual({ status: "limit", terms: full });
  });

  it("não altera a lista recebida", () => {
    const terms = ["engate"];
    commitSearchTerm(terms, "novo");
    expect(terms).toEqual(["engate"]);
  });
});

describe("effectiveSearchTerms", () => {
  it("o texto do campo conta como mais um termo", () => {
    expect(effectiveSearchTerms(["engate"], "40")).toEqual(["engate", "40"]);
  });

  it("texto vazio ou igual a um chip não duplica o filtro", () => {
    expect(effectiveSearchTerms(["engate"], "  ")).toEqual(["engate"]);
    expect(effectiveSearchTerms(["Engate"], "engate")).toEqual(["Engate"]);
  });

  it("fixar o texto não muda a consulta (mesmos termos, mesma ordem)", () => {
    const committed = commitSearchTerm(["engate"], "40").terms;
    expect(effectiveSearchTerms(committed, "")).toEqual(effectiveSearchTerms(["engate"], "40"));
  });
});

describe("toggleCategory / sortByOrder", () => {
  const order = ["hidraulica", "gas", "conexoes", "flexiveis"];

  it("marca e desmarca mantendo a ordem do catálogo, não a dos cliques", () => {
    const afterFlex = toggleCategory([], "flexiveis", order);
    const afterGas = toggleCategory(afterFlex, "gas", order);
    expect(afterGas).toEqual(["gas", "flexiveis"]);
    expect(toggleCategory(afterGas, "flexiveis", order)).toEqual(["gas"]);
  });

  it("slug fora da ordem conhecida vai para o fim", () => {
    expect(sortByOrder(["x", "conexoes", "hidraulica"], order)).toEqual(["hidraulica", "conexoes", "x"]);
  });
});

describe("buildListingQuery", () => {
  it("repete category e search, um parâmetro por valor", () => {
    const qs = buildListingQuery({
      searchTerms: ["engate", "40 cm"],
      categories: ["gas", "conexoes"],
      bestSeller: true,
      page: 3,
    });
    expect(qs.getAll("search")).toEqual(["engate", "40 cm"]);
    expect(qs.getAll("category")).toEqual(["gas", "conexoes"]);
    expect(qs.get("bestSeller")).toBe("1");
    expect(qs.get("page")).toBe("3");
    expect(qs.toString()).toBe("search=engate&search=40+cm&category=gas&category=conexoes&bestSeller=1&page=3");
  });

  it("omite página 1, campeões desligado e listas vazias", () => {
    const qs = buildListingQuery({ searchTerms: [], categories: [], bestSeller: false, page: 1 });
    expect(qs.toString()).toBe("");
  });

  it("inclui perPage quando pedido (chamada da API)", () => {
    const qs = buildListingQuery({ searchTerms: [], categories: ["gas"], bestSeller: false, perPage: 20 });
    expect(qs.toString()).toBe("category=gas&perPage=20");
  });

  it("ida e volta pela URL preserva os filtros", () => {
    const qs = new URLSearchParams(
      buildListingQuery({ searchTerms: ["válvula", "1/2"], categories: ["hidro-latao"], bestSeller: false }).toString()
    );
    expect(normalizeSearchTerms(qs.getAll("search"))).toEqual(["válvula", "1/2"]);
    expect(normalizeCategorySlugs(qs.getAll("category"))).toEqual(["hidro-latao"]);
  });
});

describe("sameList", () => {
  it("compara ordem e conteúdo", () => {
    expect(sameList(["a", "b"], ["a", "b"])).toBe(true);
    expect(sameList(["a", "b"], ["b", "a"])).toBe(false);
    expect(sameList(["a"], ["a", "b"])).toBe(false);
    expect(sameList([], [])).toBe(true);
  });
});

describe("readListingState (mesma leitura no SSR e no cliente)", () => {
  const order = ["hidraulica", "gas", "conexoes"];

  it("lê termos, categorias conhecidas na ordem do catálogo, campeões e página", () => {
    const params = new URLSearchParams(
      "search=engate&search=Engate&search=40&category=conexoes&category=inexistente&category=gas&bestSeller=1&page=3"
    );
    expect(readListingState(params, order)).toEqual({
      searchTerms: ["engate", "40"],
      categories: ["gas", "conexoes"],
      bestSeller: true,
      page: 3,
    });
  });

  it("URL vazia ou inválida cai no estado neutro", () => {
    expect(readListingState(new URLSearchParams("page=abc&bestSeller=sim&category=inexistente"), order)).toEqual({
      searchTerms: [],
      categories: [],
      bestSeller: false,
      page: 1,
    });
    expect(readListingState(new URLSearchParams("page=-2"), order).page).toBe(1);
    expect(readListingState(new URLSearchParams("page=2.7"), order).page).toBe(2);
  });
});

describe("matchesServerRender (voltar/avançar restaura renderização em cache)", () => {
  const server = { searchTerms: [], categories: [], bestSeller: false, page: 1 };

  it("mesmos filtros e página: os itens do servidor servem", () => {
    expect(matchesServerRender({ ...server }, server, 37)).toBe(true);
  });

  it("filtro aplicado no cliente depois da renderização: precisa buscar de novo", () => {
    expect(matchesServerRender({ ...server, categories: ["gas"] }, server, 37)).toBe(false);
    expect(matchesServerRender({ ...server, searchTerms: ["engate"] }, server, 37)).toBe(false);
    expect(matchesServerRender({ ...server, bestSeller: true }, server, 37)).toBe(false);
    expect(matchesServerRender({ ...server, page: 3 }, server, 37)).toBe(false);
  });

  it("página além do fim conta como a mesma quando o servidor a limitou à última", () => {
    expect(matchesServerRender({ ...server, page: 999 }, { ...server, page: 37 }, 37)).toBe(true);
    expect(matchesServerRender({ ...server, page: 999 }, { ...server, page: 1 }, 37)).toBe(false);
  });
});
