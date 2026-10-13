import { describe, it, expect, vi } from "vitest";
import { ToolInputError } from "./mcp-protocol";
import {
  MAX_SEARCH_RESULTS,
  MCP_TOOL_NAMES,
  buildMcpTools,
  type CatalogSource,
  type ProductDetail,
} from "./mcp-tools";

function fakeSource(overrides: Partial<CatalogSource> = {}): CatalogSource {
  return {
    company: vi.fn(async () => ({ razaoSocial: "ROCO" })),
    howToBuy: vi.fn(async () => ({ orcamento: "https://roco.com.br/pt/contato" })),
    categories: vi.fn(async () => [{ slug: "gas", nome: "Gás", produtos: 130, url: "https://roco.com.br/pt/produtos?category=gas" }]),
    categorySlugs: vi.fn(async () => ["gas", "conexoes"]),
    search: vi.fn(async () => ({ total: 0, itens: [] })),
    product: vi.fn(async () => null),
    buildQuote: vi.fn(async () => ({ itens: [], nao_encontrados: [], link_orcamento: null, instrucoes: "" })),
    ...overrides,
  };
}

const detail: ProductDetail = {
  sku: "1234",
  nome: "Flexível para gás",
  categorias: ["Gás"],
  campeao_de_vendas: true,
  url: "https://roco.com.br/pt/produtos/flexivel-gas",
  embalagens: [{ descricao: "Blister — 12 unidades" }],
  imagens: [],
  categorias_detalhe: [],
  solicitar_orcamento_url: "https://roco.com.br/pt/contato?produto=flexivel-gas",
};

async function toolByName(source: CatalogSource, name: string) {
  const tools = await buildMcpTools(source);
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`ferramenta ${name} ausente`);
  return tool;
}

describe("buildMcpTools", () => {
  it("expõe exatamente as 6 ferramentas de MCP_TOOL_NAMES, na mesma ordem", async () => {
    const tools = await buildMcpTools(fakeSource());
    expect(tools.map((tool) => tool.name)).toEqual([...MCP_TOOL_NAMES]);
    expect(tools).toHaveLength(6);
  });

  it("todas são somente leitura (readOnlyHint true) e não destrutivas", async () => {
    const tools = await buildMcpTools(fakeSource());
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint, tool.name).toBe(true);
      expect(tool.annotations?.destructiveHint, tool.name).toBe(false);
    }
  });

  it("inputSchema sem $schema e com additionalProperties false", async () => {
    const tools = await buildMcpTools(fakeSource());
    for (const tool of tools) {
      expect(tool.inputSchema, tool.name).not.toHaveProperty("$schema");
      expect(tool.inputSchema.additionalProperties, tool.name).toBe(false);
    }
  });

  it("enum de categorias vem da fonte (listado no schema de buscar_produtos)", async () => {
    const search = await toolByName(fakeSource(), "buscar_produtos");
    expect(JSON.stringify(search.inputSchema)).toContain('"gas"');
    expect(JSON.stringify(search.inputSchema)).toContain('"conexoes"');
  });

  describe("sobre_roco / como_comprar / listar_categorias", () => {
    it("repassam o idioma com default pt", async () => {
      const source = fakeSource();
      await (await toolByName(source, "sobre_roco")).run({});
      expect(source.company).toHaveBeenLastCalledWith("pt");
      await (await toolByName(source, "como_comprar")).run({ idioma: "en" });
      expect(source.howToBuy).toHaveBeenLastCalledWith("en");
    });

    it("idioma fora de pt/en é recusado", async () => {
      const tool = await toolByName(fakeSource(), "sobre_roco");
      await expect(tool.run({ idioma: "es" })).rejects.toBeInstanceOf(ToolInputError);
    });

    it("listar_categorias embrulha a lista em { categorias }", async () => {
      const result = await (await toolByName(fakeSource(), "listar_categorias")).run({});
      expect(result).toEqual({
        categorias: [{ slug: "gas", nome: "Gás", produtos: 130, url: "https://roco.com.br/pt/produtos?category=gas" }],
      });
    });
  });

  describe("buscar_produtos", () => {
    it("sem argumentos: defaults (limite 10, idioma pt, sem termos, sem categorias, sem campeões)", async () => {
      const source = fakeSource();
      await (await toolByName(source, "buscar_produtos")).run({});
      expect(source.search).toHaveBeenCalledWith({
        locale: "pt",
        terms: [],
        categories: [],
        bestSeller: false,
        limit: 10,
      });
    });

    it("repassa termos, categorias, campeões e limite informados", async () => {
      const source = fakeSource();
      await (await toolByName(source, "buscar_produtos")).run({
        termos: ["flexivel", "gas"],
        categorias: ["gas"],
        so_campeoes: true,
        limite: 5,
        idioma: "en",
      });
      expect(source.search).toHaveBeenCalledWith({
        locale: "en",
        terms: ["flexivel", "gas"],
        categories: ["gas"],
        bestSeller: true,
        limit: 5,
      });
    });

    it("devolve o resultado da fonte sem alterar", async () => {
      const item = { sku: "1", nome: "A", categorias: [], campeao_de_vendas: false, url: "https://roco.com.br/x" };
      const source = fakeSource({ search: vi.fn(async () => ({ total: 1, itens: [item] })) });
      expect(await (await toolByName(source, "buscar_produtos")).run({})).toEqual({ total: 1, itens: [item] });
    });

    it(`limite ${MAX_SEARCH_RESULTS + 1} é recusado`, async () => {
      const tool = await toolByName(fakeSource(), "buscar_produtos");
      await expect(tool.run({ limite: MAX_SEARCH_RESULTS + 1 })).rejects.toBeInstanceOf(ToolInputError);
    });

    it("limite 0 é recusado", async () => {
      const tool = await toolByName(fakeSource(), "buscar_produtos");
      await expect(tool.run({ limite: 0 })).rejects.toBeInstanceOf(ToolInputError);
    });

    it("categoria fora do enum é recusada e a fonte não é consultada", async () => {
      const source = fakeSource();
      const tool = await toolByName(source, "buscar_produtos");
      await expect(tool.run({ categorias: ["nao-existe"] })).rejects.toBeInstanceOf(ToolInputError);
      expect(source.search).not.toHaveBeenCalled();
    });

    it("propriedade extra é recusada (strict)", async () => {
      const tool = await toolByName(fakeSource(), "buscar_produtos");
      await expect(tool.run({ preco_maximo: 10 })).rejects.toBeInstanceOf(ToolInputError);
    });

    it("mensagem de erro cita o campo para o modelo corrigir", async () => {
      const tool = await toolByName(fakeSource(), "buscar_produtos");
      await expect(tool.run({ limite: 99 })).rejects.toThrow(/limite/);
    });
  });

  describe("obter_produto", () => {
    it("exige slug ou sku", async () => {
      const source = fakeSource();
      const tool = await toolByName(source, "obter_produto");
      await expect(tool.run({})).rejects.toBeInstanceOf(ToolInputError);
      expect(source.product).not.toHaveBeenCalled();
    });

    it("aceita slug e repassa idioma pt por padrão", async () => {
      const source = fakeSource({ product: vi.fn(async () => detail) });
      const result = await (await toolByName(source, "obter_produto")).run({ slug: "flexivel-gas" });
      expect(source.product).toHaveBeenCalledWith({ locale: "pt", slug: "flexivel-gas", sku: undefined });
      expect(result).toEqual(detail);
    });

    it("aceita sku", async () => {
      const source = fakeSource({ product: vi.fn(async () => detail) });
      await (await toolByName(source, "obter_produto")).run({ sku: "1234", idioma: "en" });
      expect(source.product).toHaveBeenCalledWith({ locale: "en", slug: undefined, sku: "1234" });
    });

    it("produto que a fonte não devolve → ToolInputError orientando a busca", async () => {
      const tool = await toolByName(fakeSource({ product: vi.fn(async () => null) }), "obter_produto");
      await expect(tool.run({ slug: "nao-existe" })).rejects.toThrow(/buscar_produtos/);
      await expect(tool.run({ slug: "nao-existe" })).rejects.toBeInstanceOf(ToolInputError);
    });

    it("slug vazio ou só com espaços é recusado", async () => {
      const tool = await toolByName(fakeSource(), "obter_produto");
      await expect(tool.run({ slug: "   " })).rejects.toBeInstanceOf(ToolInputError);
    });
  });
});

describe("montar_orcamento", () => {
  it("repassa itens (slug ou SKU) com quantidade padrão 1 e idioma pt", async () => {
    const source = fakeSource();
    const tool = await toolByName(source, "montar_orcamento");
    await tool.run({ itens: [{ slug: "flexivel-gas", quantidade: 3 }, { sku: "3004" }] });
    expect(source.buildQuote).toHaveBeenCalledWith({
      locale: "pt",
      items: [
        { slug: "flexivel-gas", sku: undefined, quantity: 3 },
        { slug: undefined, sku: "3004", quantity: 1 },
      ],
    });
  });

  it("recusa lista vazia, item sem slug/SKU, slug inválido e mais de 20 itens", async () => {
    const tool = await toolByName(fakeSource(), "montar_orcamento");
    await expect(tool.run({ itens: [] })).rejects.toBeInstanceOf(ToolInputError);
    await expect(tool.run({ itens: [{ quantidade: 2 }] })).rejects.toBeInstanceOf(ToolInputError);
    await expect(tool.run({ itens: [{ slug: "../x" }] })).rejects.toBeInstanceOf(ToolInputError);
    const many = Array.from({ length: 21 }, (_, i) => ({ sku: String(1000 + i) }));
    await expect(tool.run({ itens: many })).rejects.toBeInstanceOf(ToolInputError);
  });

  it("é somente leitura (não grava nada no servidor)", async () => {
    const tool = await toolByName(fakeSource(), "montar_orcamento");
    expect(tool.annotations?.readOnlyHint).toBe(true);
  });
});
