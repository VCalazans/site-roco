import { describe, it, expect } from "vitest";
import pt from "@/i18n/dictionaries/pt.json";
import { buildLlmsFullTxt, buildLlmsTxt, type LlmsInput } from "./llms";

const SITE = "https://roco.com.br";

function makeInput(overrides: Partial<LlmsInput> = {}): LlmsInput {
  return {
    copy: pt.ai.llms,
    organization: pt.ai.organization,
    brand: "ROCO",
    description: "Fabricante de soluções hidrossanitárias e hidráulicas.",
    productLines: ["Hidrossanitários", "Conexões"],
    categories: [
      { name: "Gás", count: 130, url: `${SITE}/pt/produtos?category=gas` },
      { name: "Conexões", count: 39, url: `${SITE}/pt/produtos?category=conexoes` },
    ],
    contact: {
      email: "contato@roco.com.br",
      phone: "4733352012",
      addressHeadquarters: "Rua Amsterdam, 853 - Itoupavazinha, Blumenau - SC, CEP 89070-490",
      addressPlant: "Rua Industrial, 1000 - Gaspar - SC",
    },
    profiles: ["LinkedIn: https://www.linkedin.com/company/roco"],
    urls: {
      site: `${SITE}/`,
      home: `${SITE}/pt`,
      products: `${SITE}/pt/produtos`,
      about: `${SITE}/pt/sobre`,
      contact: `${SITE}/pt/contato`,
      representatives: `${SITE}/pt/representantes`,
      catalog: "https://catalogo.roco.com.br/catalogo-roco",
      full: `${SITE}/llms-full.txt`,
      mcp: `${SITE}/mcp`,
    },
    mcpTools: ["sobre_roco", "buscar_produtos"],
    ...overrides,
  };
}

describe("buildLlmsTxt", () => {
  it("começa com o título '# ROCO'", () => {
    expect(buildLlmsTxt(makeInput()).startsWith("# ROCO\n")).toBe(true);
  });

  it("traz a linha de resumo '> ' com razão social e ano de fundação", () => {
    const text = buildLlmsTxt(makeInput());
    const summary = text.split("\n").find((line) => line.startsWith("> "));
    expect(summary).toBeDefined();
    expect(summary).toContain("ROCO Indústria Metalplástica S.A.");
    expect(summary).toContain("2014");
    expect(summary).not.toContain("{");
  });

  it("não contém HTML nem placeholders não resolvidos", () => {
    const text = buildLlmsTxt(makeInput());
    expect(text).not.toContain("<");
    expect(text).not.toMatch(/\{[a-zA-Z]+\}/);
  });

  it("links são absolutos (https)", () => {
    const text = buildLlmsTxt(makeInput());
    const links = [...text.matchAll(/\]\(([^)]+)\)/g)].map((match) => match[1]);
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toMatch(/^https:\/\//);
    }
  });

  it("inclui a seção de categorias com contagem quando há categorias", () => {
    const text = buildLlmsTxt(makeInput());
    expect(text).toContain(`## ${pt.ai.llms.categoriesTitle}`);
    expect(text).toContain(`- [Gás](${SITE}/pt/produtos?category=gas): 130 produtos`);
  });

  it("omite a seção de categorias quando a lista está vazia", () => {
    const text = buildLlmsTxt(makeInput({ categories: [] }));
    expect(text).not.toContain(`## ${pt.ai.llms.categoriesTitle}`);
  });

  it("contato omite campos vazios (sem e-mail/telefone/endereço não sai a linha)", () => {
    const text = buildLlmsTxt(
      makeInput({ contact: { email: "", phone: "", addressHeadquarters: "", addressPlant: "" }, profiles: [] })
    );
    expect(text).not.toContain(`## ${pt.ai.llms.contactTitle}`);
    expect(text).not.toContain("E-mail:");
    expect(text).not.toContain("Telefone/WhatsApp:");
  });

  it("contato formata telefone com +55 e mantém e-mail", () => {
    const text = buildLlmsTxt(makeInput());
    expect(text).toContain("E-mail: contato@roco.com.br");
    expect(text).toContain("Telefone/WhatsApp: +554733352012");
  });

  it("telefone com menos de 10 dígitos não aparece", () => {
    const text = buildLlmsTxt(makeInput({ contact: { email: "", phone: "123", addressHeadquarters: "", addressPlant: "" }, profiles: [] }));
    expect(text).not.toContain("Telefone/WhatsApp:");
  });

  it("quebras de linha dentro de um valor não quebram a lista", () => {
    const text = buildLlmsTxt(
      makeInput({ productLines: ["Linha\n\nquebrada   com\tespaços"] })
    );
    expect(text).toContain("- Linha quebrada com espaços");
  });

  it("lista as ferramentas MCP e o link para a versão completa", () => {
    const text = buildLlmsTxt(makeInput());
    expect(text).toContain("sobre_roco, buscar_produtos");
    expect(text).toContain(`Versão completa, com todos os produtos: ${SITE}/llms-full.txt`);
  });
});

describe("buildLlmsFullTxt", () => {
  it("traz uma linha por produto com SKU, nome e categorias", () => {
    const text = buildLlmsFullTxt(makeInput(), [
      { sku: "1234", name: "Válvula de caixa", categories: ["Hidrossanitários", "Caixa acoplada"], url: `${SITE}/pt/produtos/valvula` },
      { sku: "9", name: "Flexível", categories: [], url: `${SITE}/pt/produtos/flexivel` },
    ]);
    expect(text).toContain(`## ${pt.ai.llms.productsTitle}`);
    expect(text).toContain(`- [1234 — Válvula de caixa](${SITE}/pt/produtos/valvula) — Hidrossanitários, Caixa acoplada`);
    expect(text).toContain(`- [9 — Flexível](${SITE}/pt/produtos/flexivel)`);
    expect(text).not.toContain(`[9 — Flexível](${SITE}/pt/produtos/flexivel) —`);
  });

  it("cada produto ocupa exatamente uma linha da lista", () => {
    const products = Array.from({ length: 5 }, (_, i) => ({
      sku: String(1000 + i),
      name: `Produto ${i}`,
      categories: ["Gás"],
      url: `${SITE}/pt/produtos/p-${i}`,
    }));
    const lines = buildLlmsFullTxt(makeInput(), products).split("\n").filter((line) => line.startsWith("- [1"));
    expect(lines).toHaveLength(5);
  });

  it("nome com quebra de linha continua numa única linha da lista", () => {
    const text = buildLlmsFullTxt(makeInput(), [
      { sku: "7", name: "Nome\ncom quebra\r\nno meio", categories: ["A\nB"], url: `${SITE}/pt/produtos/x` },
    ]);
    const item = text.split("\n").find((line) => line.includes("[7 —"));
    expect(item).toBe(`- [7 — Nome com quebra no meio](${SITE}/pt/produtos/x) — A B`);
  });

  it("sem produtos, a seção existe mas sem itens", () => {
    const text = buildLlmsFullTxt(makeInput(), []);
    const heading = `## ${pt.ai.llms.productsTitle}`;
    expect(text).toContain(heading);
    const tail = text.slice(text.indexOf(heading) + heading.length);
    expect(tail).not.toMatch(/^- \[/m);
  });

  it("o full traz o mesmo conteúdo do txt curto (resumo, páginas e contato) antes da lista de produtos", () => {
    const full = buildLlmsFullTxt(makeInput(), []);
    expect(full).toContain(`- [${pt.ai.llms.pages.home}](${SITE}/pt)`);
    expect(full).toContain("E-mail: contato@roco.com.br");
    expect(full.indexOf(`## ${pt.ai.llms.productsTitle}`)).toBeGreaterThan(full.indexOf("## "+pt.ai.llms.pagesTitle));
  });
});
