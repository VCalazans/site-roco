import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildWebMcpTools,
  getModelContext,
  isCatalogSlug,
  listingQuery,
  type QuoteItem,
  type WebMcpDeps,
  type WebMcpTool,
} from "./webmcp";

const PRODUCT_API = {
  slug: "flexivel-gas",
  sku: "1234",
  namePt: "Flexível para gás",
  nameEn: "Gas flexible hose",
  bestSeller: true,
  images: [{ url: "https://img.test/1.png" }],
};

function makeDeps(overrides: Partial<WebMcpDeps> = {}) {
  const deps: WebMcpDeps = {
    locale: "pt",
    productsPath: "/pt/produtos",
    contactPath: "/pt/contato",
    quotePath: "/pt/orcamento",
    fetchJson: vi.fn(async () => null),
    navigate: vi.fn(),
    addToQuote: vi.fn(() => true),
    readQuote: vi.fn(() => [] as readonly QuoteItem[]),
    ...overrides,
  };
  return deps;
}

function toolsOf(deps: WebMcpDeps): Record<string, WebMcpTool> {
  return Object.fromEntries(buildWebMcpTools(deps).map((tool) => [tool.name, tool]));
}

describe("webmcp", () => {
  describe("isCatalogSlug", () => {
    it("aceita slug minúsculo com dígitos e hífens", () => {
      expect(isCatalogSlug("flexivel-gas-1")).toBe(true);
      expect(isCatalogSlug("1234")).toBe(true);
    });

    it("recusa caminho, esquema, maiúsculas, espaços e hífen no início/fim", () => {
      for (const value of ["../x", "javascript:alert(1)", "Gas", "a b", "-x", "x-", "a/b", "a?b=1", ""]) {
        expect(isCatalogSlug(value), value).toBe(false);
      }
    });

    it("recusa slug acima de 200 caracteres", () => {
      expect(isCatalogSlug("a".repeat(201))).toBe(false);
      expect(isCatalogSlug("a".repeat(200))).toBe(true);
    });
  });

  describe("listingQuery", () => {
    it("sem filtros devolve string vazia", () => {
      expect(listingQuery({ terms: [], categories: [], bestSeller: false })).toBe("");
    });

    it("repete parâmetros e ordena search, category, bestSeller, perPage", () => {
      expect(
        listingQuery({ terms: ["flexivel", "gas"], categories: ["gas", "conexoes"], bestSeller: true, perPage: 5 })
      ).toBe("?search=flexivel&search=gas&category=gas&category=conexoes&bestSeller=1&perPage=5");
    });

    it("codifica termos com acento e espaço", () => {
      expect(listingQuery({ terms: ["flexível gás"], categories: [], bestSeller: false })).toBe(
        "?search=flex%C3%ADvel+g%C3%A1s"
      );
    });
  });

  describe("getModelContext", () => {
    it("ambiente node (sem document) devolve null", () => {
      expect(getModelContext()).toBeNull();
    });
  });

  describe("buildWebMcpTools", () => {
    it("expõe as 6 ferramentas com nomes estáveis", () => {
      expect(buildWebMcpTools(makeDeps()).map((tool) => tool.name)).toEqual([
        "buscar_produtos",
        "abrir_produto",
        "filtrar_catalogo",
        "adicionar_ao_orcamento",
        "ver_orcamento",
        "preparar_contato",
      ]);
    });

    it("cada ferramenta tem descrição e inputSchema de objeto", () => {
      for (const tool of buildWebMcpTools(makeDeps())) {
        expect(tool.description.length, tool.name).toBeGreaterThan(20);
        expect(tool.inputSchema.type, tool.name).toBe("object");
      }
    });

    describe("buscar_produtos", () => {
      it("monta /api/products com termos, categorias válidas e perPage", async () => {
        const deps = makeDeps({
          fetchJson: vi.fn(async () => ({ total: 1, items: [PRODUCT_API] })),
        });
        await toolsOf(deps).buscar_produtos.execute({ termos: ["flexivel"], categorias: ["gas"], limite: 5 });
        expect(deps.fetchJson).toHaveBeenCalledWith("/api/products?search=flexivel&category=gas&perPage=5");
      });

      it("filtra categorias que não são slug do catálogo", async () => {
        const deps = makeDeps({ fetchJson: vi.fn(async () => ({ total: 0, items: [] })) });
        await toolsOf(deps).buscar_produtos.execute({ categorias: ["../admin", "gas", "Gas Liquido"] });
        expect(deps.fetchJson).toHaveBeenCalledWith("/api/products?category=gas&perPage=10");
      });

      it("limite fora da faixa é limitado (padrão 10, teto 20, mínimo 1)", async () => {
        const deps = makeDeps({ fetchJson: vi.fn(async () => ({ total: 0, items: [] })) });
        const tools = toolsOf(deps);
        await tools.buscar_produtos.execute({ limite: 500 });
        await tools.buscar_produtos.execute({ limite: -3 });
        await tools.buscar_produtos.execute({ limite: "abc" });
        expect(deps.fetchJson).toHaveBeenNthCalledWith(1, "/api/products?perPage=20");
        expect(deps.fetchJson).toHaveBeenNthCalledWith(2, "/api/products?perPage=1");
        expect(deps.fetchJson).toHaveBeenNthCalledWith(3, "/api/products?perPage=10");
      });

      it("aceita o input como string JSON", async () => {
        const deps = makeDeps({ fetchJson: vi.fn(async () => ({ total: 0, items: [] })) });
        await toolsOf(deps).buscar_produtos.execute(JSON.stringify({ termos: ["gas"], so_campeoes: true }));
        expect(deps.fetchJson).toHaveBeenCalledWith("/api/products?search=gas&bestSeller=1&perPage=10");
      });

      it("string JSON inválida é tratada como entrada vazia", async () => {
        const deps = makeDeps({ fetchJson: vi.fn(async () => ({ total: 0, items: [] })) });
        await toolsOf(deps).buscar_produtos.execute("{não é json");
        expect(deps.fetchJson).toHaveBeenCalledWith("/api/products?perPage=10");
      });

      it("devolve JSON com itens resumidos e nome no idioma da página", async () => {
        const deps = makeDeps({
          locale: "en",
          fetchJson: vi.fn(async () => ({ total: 1, items: [PRODUCT_API] })),
        });
        const result = JSON.parse(await toolsOf(deps).buscar_produtos.execute({}));
        expect(result).toEqual({
          total: 1,
          itens: [
            {
              sku: "1234",
              nome: "Gas flexible hose",
              slug: "flexivel-gas",
              campeao_de_vendas: true,
              url: "/pt/produtos/flexivel-gas",
            },
          ],
        });
      });

      it("sem nome em inglês cai no nome português", async () => {
        const deps = makeDeps({
          locale: "en",
          fetchJson: vi.fn(async () => ({ total: 1, items: [{ ...PRODUCT_API, nameEn: null }] })),
        });
        const result = JSON.parse(await toolsOf(deps).buscar_produtos.execute({}));
        expect(result.itens[0].nome).toBe("Flexível para gás");
      });

      it("resposta inválida da API vira mensagem amigável (não JSON cru)", async () => {
        const deps = makeDeps({ fetchJson: vi.fn(async () => null) });
        const text = await toolsOf(deps).buscar_produtos.execute({});
        expect(text).toContain("Não foi possível consultar o catálogo");
      });
    });

    describe("abrir_produto", () => {
      it("abre a página do produto pelo slug válido", async () => {
        const deps = makeDeps();
        const text = await toolsOf(deps).abrir_produto.execute({ slug: "flexivel-gas" });
        expect(deps.navigate).toHaveBeenCalledTimes(1);
        expect(deps.navigate).toHaveBeenCalledWith("/pt/produtos/flexivel-gas");
        expect(text).toContain("/pt/produtos/flexivel-gas");
      });

      it.each(["../x", "javascript:alert(1)", "Flexivel", "a b", "https://evil.test"])(
        "recusa slug inválido %s sem navegar",
        async (slug) => {
          const deps = makeDeps();
          const text = await toolsOf(deps).abrir_produto.execute({ slug });
          expect(deps.navigate).not.toHaveBeenCalled();
          expect(text).toContain("Slug inválido");
        }
      );

      it("slug ausente é recusado sem navegar", async () => {
        const deps = makeDeps();
        await toolsOf(deps).abrir_produto.execute({});
        expect(deps.navigate).not.toHaveBeenCalled();
      });
    });

    describe("filtrar_catalogo", () => {
      it("navega para a listagem com os filtros válidos", async () => {
        const deps = makeDeps();
        await toolsOf(deps).filtrar_catalogo.execute({ termos: ["gas"], categorias: ["conexoes", "x/y"], so_campeoes: true });
        expect(deps.navigate).toHaveBeenCalledWith("/pt/produtos?search=gas&category=conexoes&bestSeller=1");
      });

      it("sem filtros navega para a listagem pura", async () => {
        const deps = makeDeps();
        await toolsOf(deps).filtrar_catalogo.execute({});
        expect(deps.navigate).toHaveBeenCalledWith("/pt/produtos");
      });
    });

    describe("adicionar_ao_orcamento", () => {
      let deps: WebMcpDeps;

      beforeEach(() => {
        deps = makeDeps({
          fetchJson: vi.fn(async () => PRODUCT_API),
        });
      });

      it("busca o produto em /api/products/{slug} e adiciona com quantidade", async () => {
        const text = await toolsOf(deps).adicionar_ao_orcamento.execute({ slug: "flexivel-gas", quantidade: 3 });
        expect(deps.fetchJson).toHaveBeenCalledWith("/api/products/flexivel-gas");
        expect(deps.addToQuote).toHaveBeenCalledWith(
          { slug: "flexivel-gas", sku: "1234", name: "Flexível para gás", image: "https://img.test/1.png" },
          3
        );
        expect(text).toContain("adicionado ao orçamento");
        expect(text).toContain("/pt/orcamento");
      });

      it("quantidade ausente vale 1", async () => {
        await toolsOf(deps).adicionar_ao_orcamento.execute({ slug: "flexivel-gas" });
        expect(deps.addToQuote).toHaveBeenCalledWith(expect.anything(), 1);
      });

      it("quantidade é limitada entre 1 e 9999", async () => {
        const tools = toolsOf(deps);
        await tools.adicionar_ao_orcamento.execute({ slug: "flexivel-gas", quantidade: 0 });
        await tools.adicionar_ao_orcamento.execute({ slug: "flexivel-gas", quantidade: 99999 });
        await tools.adicionar_ao_orcamento.execute({ slug: "flexivel-gas", quantidade: -5 });
        const quantities = (deps.addToQuote as ReturnType<typeof vi.fn>).mock.calls.map((call) => call[1]);
        expect(quantities).toEqual([1, 9999, 1]);
      });

      it("slug inválido não consulta a API nem adiciona", async () => {
        const text = await toolsOf(deps).adicionar_ao_orcamento.execute({ slug: "../x" });
        expect(deps.fetchJson).not.toHaveBeenCalled();
        expect(deps.addToQuote).not.toHaveBeenCalled();
        expect(text).toContain("Slug inválido");
      });

      it("produto inexistente não é adicionado", async () => {
        deps = makeDeps({ fetchJson: vi.fn(async () => null), addToQuote: vi.fn(() => true) });
        const text = await toolsOf(deps).adicionar_ao_orcamento.execute({ slug: "nao-existe" });
        expect(deps.addToQuote).not.toHaveBeenCalled();
        expect(text).toContain("não encontrado");
      });

      it("limite da lista de orçamento: informa que não foi adicionado", async () => {
        deps = makeDeps({ fetchJson: vi.fn(async () => PRODUCT_API), addToQuote: vi.fn(() => false) });
        const text = await toolsOf(deps).adicionar_ao_orcamento.execute({ slug: "flexivel-gas" });
        expect(text).toContain("Não foi possível adicionar");
      });

      it("nunca navega nem envia nada", async () => {
        await toolsOf(deps).adicionar_ao_orcamento.execute({ slug: "flexivel-gas" });
        expect(deps.navigate).not.toHaveBeenCalled();
      });
    });

    describe("ver_orcamento", () => {
      it("lista os itens do orçamento local com a página do orçamento", async () => {
        const deps = makeDeps({
          readQuote: vi.fn(() => [{ slug: "a", name: "Produto A", sku: "1", quantity: 2 }]),
        });
        const result = JSON.parse(await toolsOf(deps).ver_orcamento.execute({}));
        expect(result).toEqual({
          itens: [{ sku: "1", nome: "Produto A", slug: "a", quantidade: 2 }],
          pagina: "/pt/orcamento",
        });
      });
    });

    describe("preparar_contato", () => {
      it("abre o contato com assunto, produto e origem da IA — e não envia nada", async () => {
        const deps = makeDeps();
        const text = await toolsOf(deps).preparar_contato.execute({ assunto: "call_back", slug: "flexivel-gas" });
        expect(deps.navigate).toHaveBeenCalledTimes(1);
        const href = (deps.navigate as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
        expect(href.startsWith("/pt/contato?")).toBe(true);
        const params = new URLSearchParams(href.split("?")[1]);
        expect(params.get("assunto")).toBe("call_back");
        expect(params.get("produto")).toBe("flexivel-gas");
        expect(params.get("origem")).toBe("assistente-ia");
        expect(deps.fetchJson).not.toHaveBeenCalled();
        expect(deps.addToQuote).not.toHaveBeenCalled();
        expect(text).toContain("A pessoa precisa preencher e enviar");
      });

      it("assunto desconhecido vira 'quote'", async () => {
        const deps = makeDeps();
        await toolsOf(deps).preparar_contato.execute({ assunto: "hackear" });
        const href = (deps.navigate as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
        expect(new URLSearchParams(href.split("?")[1]).get("assunto")).toBe("quote");
      });

      it("sem assunto e sem produto: só assunto padrão e origem", async () => {
        const deps = makeDeps();
        await toolsOf(deps).preparar_contato.execute({});
        const href = (deps.navigate as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
        const params = new URLSearchParams(href.split("?")[1]);
        expect(params.has("produto")).toBe(false);
        expect(params.get("assunto")).toBe("quote");
      });

      it("slug de produto inválido não entra na URL", async () => {
        const deps = makeDeps();
        await toolsOf(deps).preparar_contato.execute({ slug: "javascript:alert(1)" });
        const href = (deps.navigate as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
        expect(href).not.toContain("produto=");
        expect(href).not.toContain("javascript");
      });
    });
  });
});
