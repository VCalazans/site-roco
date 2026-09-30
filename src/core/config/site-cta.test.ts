import { describe, expect, it } from "vitest";
import {
  LEGACY_QUOTE_SEGMENT,
  ONLINE_CATALOG_URL,
  QUOTE_SEGMENT,
  contactPath,
  localizeInternalHref,
  quotePath,
  resolveCtaHref,
  resolveDestination,
} from "./site";

/**
 * Spec 001: "Orçamento" (rota `/orcamento`, placeholder `#orcamento`) e os
 * links EDITÁVEIS no painel (`localizeInternalHref`/`resolveCtaHref`).
 */
describe("orçamento (ex-carrinho)", () => {
  it("usa o segmento novo e guarda o antigo só para o redirect", () => {
    expect(QUOTE_SEGMENT).toBe("orcamento");
    expect(LEGACY_QUOTE_SEGMENT).toBe("carrinho");
  });

  it("monta o caminho com o locale", () => {
    expect(quotePath("pt")).toBe("/pt/orcamento");
    expect(quotePath("en")).toBe("/en/orcamento");
  });

  it("resolve o placeholder e o alias literal do dicionário", () => {
    expect(resolveDestination("#orcamento", "pt")).toBe("/pt/orcamento");
    expect(resolveDestination("/orcamento", "en")).toBe("/en/orcamento");
  });

  it("anexa a origem do lead — a página de orçamento captura lead", () => {
    expect(resolveDestination("#orcamento", "pt", "rodape")).toBe("/pt/orcamento?origem=rodape");
  });
});

describe("localizeInternalHref", () => {
  it("prefixa caminho interno sem locale, preservando query e fragmento", () => {
    expect(localizeInternalHref("/produtos", "pt")).toBe("/pt/produtos");
    expect(localizeInternalHref("/produtos?category=gas#topo", "en")).toBe("/en/produtos?category=gas#topo");
  });

  it("trata a raiz e raiz com query/fragmento", () => {
    expect(localizeInternalHref("/", "pt")).toBe("/pt");
    expect(localizeInternalHref("/?x=1", "pt")).toBe("/pt?x=1");
    expect(localizeInternalHref("/#sobre", "en")).toBe("/en#sobre");
  });

  it("mantém o caminho que já tem o MESMO locale", () => {
    expect(localizeInternalHref("/pt/contato", "pt")).toBe("/pt/contato");
    expect(localizeInternalHref("/en", "en")).toBe("/en");
  });

  it("troca (não empilha) o locale de outro idioma", () => {
    expect(localizeInternalHref("/pt/contato?assunto=quote", "en")).toBe("/en/contato?assunto=quote");
    expect(localizeInternalHref("/en", "pt")).toBe("/pt");
  });

  it("não confunde segmento que só COMEÇA com as letras do locale", () => {
    expect(localizeInternalHref("/ptx", "pt")).toBe("/pt/ptx");
    expect(localizeInternalHref("/entrada", "en")).toBe("/en/entrada");
    expect(localizeInternalHref("/produtos-x", "pt")).toBe("/pt/produtos-x");
  });

  it("não toca em externo, âncora, mailto/tel e protocol-relative", () => {
    for (const href of ["https://roco.com.br", "#catalogo", "mailto:a@b.com", "tel:+554733352012", "//evil.com"]) {
      expect(localizeInternalHref(href, "pt")).toBe(href);
    }
  });
});

describe("resolveCtaHref", () => {
  it("resolve placeholder e aplica locale", () => {
    expect(resolveCtaHref("#produtos", "en")).toBe("/en/produtos");
    expect(resolveCtaHref("/produtos?category=gas", "pt")).toBe("/pt/produtos?category=gas");
  });

  it("anexa a origem só em página de captura — inclusive quando o CTA já tem query", () => {
    expect(resolveCtaHref("/contato?assunto=quote", "pt", "home-fachada")).toBe(
      `${contactPath("pt")}?assunto=quote&origem=home-fachada`
    );
    expect(resolveCtaHref("/contato", "pt", "home-hero")).toBe(`${contactPath("pt")}?origem=home-hero`);
  });

  it("não anexa origem fora das páginas de captura", () => {
    expect(resolveCtaHref("/produtos", "pt", "home-destaques")).toBe("/pt/produtos");
    expect(resolveCtaHref("#sobre", "pt", "home-fachada")).toBe("#sobre");
    expect(resolveCtaHref("https://exemplo.com/x", "pt", "home-hero")).toBe("https://exemplo.com/x");
  });

  it("\"Baixar Catálogo\" (#catalogo e /catalogo) vai sempre para o catálogo online, sem origem", () => {
    expect(ONLINE_CATALOG_URL).toBe("https://catalogo.roco.com.br/catalogo-roco");
    expect(resolveCtaHref("#catalogo", "pt", "home-hero")).toBe(ONLINE_CATALOG_URL);
    expect(resolveCtaHref("/catalogo", "en", "rodape")).toBe(ONLINE_CATALOG_URL);
    expect(resolveDestination("#catalogo", "pt")).toBe(ONLINE_CATALOG_URL);
  });

  it("sem origem, só resolve e localiza", () => {
    expect(resolveCtaHref("/contato", "en")).toBe("/en/contato");
  });
});
