import { describe, it, expect } from "vitest";
import { absoluteUrl } from "@/core/config/metadata";
import {
  ORGANIZATION_ID,
  WEBSITE_ID,
  buildBreadcrumbList,
  buildItemList,
  buildOrganization,
  buildProduct,
  buildWebSite,
  isValidEan13,
  parseBrazilianAddress,
  serializeJsonLd,
  toInternationalPhone,
  type OrganizationInput,
} from "./json-ld";

/** Verifica recursivamente que nenhum valor é `undefined`, `null`, `""` ou lista vazia. */
function assertNoEmptyValues(node: unknown, path = "root"): void {
  if (Array.isArray(node)) {
    expect(node.length, `${path} não pode ser lista vazia`).toBeGreaterThan(0);
    node.forEach((item, index) => assertNoEmptyValues(item, `${path}[${index}]`));
    return;
  }
  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      expect(value, `${path}.${key}`).not.toBeUndefined();
      expect(value, `${path}.${key}`).not.toBeNull();
      expect(value, `${path}.${key}`).not.toBe("");
      assertNoEmptyValues(value, `${path}.${key}`);
    }
  }
}

describe("json-ld", () => {
  describe("serializeJsonLd", () => {
    it("não deixa um valor fechar a tag <script>", () => {
      const out = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
      expect(out).not.toContain("</script");
      expect(out).not.toContain("<");
    });

    it("escapa U+2028 e U+2029", () => {
      const out = serializeJsonLd({ text: "a b c" });
      expect(out).not.toContain(" ");
      expect(out).not.toContain(" ");
      expect(out).toContain("\\u2028");
      expect(out).toContain("\\u2029");
    });

    it("o resultado é JSON válido que volta ao valor original", () => {
      const value = {
        name: "Conexão <b>\"x\"</b> & 'y'",
        list: ["</script>", "a b", 1, true, null],
        nested: { deep: "<!-- --> ação" },
      };
      expect(JSON.parse(serializeJsonLd(value))).toEqual(value);
    });
  });

  describe("parseBrazilianAddress", () => {
    it("separa rua, cidade, UF e CEP do endereço da matriz", () => {
      expect(parseBrazilianAddress("Rua Amsterdam, 853 - Itoupavazinha, Blumenau - SC, CEP 89070-490")).toEqual({
        "@type": "PostalAddress",
        streetAddress: "Rua Amsterdam, 853 - Itoupavazinha",
        addressLocality: "Blumenau",
        addressRegion: "SC",
        postalCode: "89070-490",
        addressCountry: "BR",
      });
    });

    it("texto livre sem cidade/UF cai inteiro em streetAddress, sem campos inventados", () => {
      const result = parseBrazilianAddress("Endereço a confirmar");
      expect(result).toEqual({
        "@type": "PostalAddress",
        streetAddress: "Endereço a confirmar",
        addressCountry: "BR",
      });
      expect(result).not.toHaveProperty("addressLocality");
      expect(result).not.toHaveProperty("addressRegion");
      expect(result).not.toHaveProperty("postalCode");
    });

    it("texto vazio ou só com espaços devolve null", () => {
      expect(parseBrazilianAddress("")).toBeNull();
      expect(parseBrazilianAddress("   ")).toBeNull();
    });

    it("CEP sem hífen é normalizado para 00000-000", () => {
      const result = parseBrazilianAddress("Rua A, 1 - Centro, Gaspar - SC, CEP 89110000");
      expect(result?.postalCode).toBe("89110-000");
    });

    it("cidade e UF são preservadas quando o CEP vem antes", () => {
      const result = parseBrazilianAddress("Rua B, 10, CEP 89110-000, Gaspar - SC");
      expect(result?.addressLocality).toBe("Gaspar");
      expect(result?.addressRegion).toBe("SC");
    });

    it("keeps a street name that starts with 'Cep' when there is no city/UF", () => {
      // Sem cidade/UF, o código remove "CEP..." com um regex SEM limite de palavra:
      // "Rua Cepagem" vira "Rua". O esperado é a rua inteira.
      expect(parseBrazilianAddress("Rua Cepagem, 50")?.streetAddress).toBe("Rua Cepagem, 50");
    });
  });

  describe("toInternationalPhone", () => {
    it("número já com DDI 55 ganha só o '+'", () => {
      expect(toInternationalPhone("554733352012")).toBe("+554733352012");
    });

    it("número nacional com DDD ganha o DDI 55", () => {
      expect(toInternationalPhone("4733352012")).toBe("+554733352012");
    });

    it("remove máscara e espaços antes de normalizar", () => {
      expect(toInternationalPhone("+55 (47) 3335-2012")).toBe("+554733352012");
    });

    it("número curto (menos de 10 dígitos) devolve undefined", () => {
      expect(toInternationalPhone("473335201")).toBeUndefined();
      expect(toInternationalPhone("")).toBeUndefined();
    });

    it("treats a 10-digit number with area code 55 (RS) as national", () => {
      // Santa Maria (RS) usa DDD 55. "55 3333-4444" sem DDI deveria virar +555533334444.
      expect(toInternationalPhone("5533334444")).toBe("+555533334444");
    });
  });

  describe("isValidEan13", () => {
    it("aceita um EAN-13 com dígito verificador correto", () => {
      // 7891234567895: soma ponderada 135 → dígito 5.
      expect(isValidEan13("7891234567895")).toBe(true);
    });

    it("rejeita dígito verificador errado", () => {
      expect(isValidEan13("7891234567890")).toBe(false);
    });

    it("rejeita tamanho diferente de 13 e caracteres não numéricos", () => {
      expect(isValidEan13("789123456789")).toBe(false);
      expect(isValidEan13("78912345678951")).toBe(false);
      expect(isValidEan13("789123456789A")).toBe(false);
    });

    it("rejeita null, undefined e string vazia", () => {
      expect(isValidEan13(null)).toBe(false);
      expect(isValidEan13(undefined)).toBe(false);
      expect(isValidEan13("")).toBe(false);
    });
  });

  describe("buildOrganization", () => {
    const base: OrganizationInput = {
      name: "ROCO",
      legalName: "ROCO Indústria Metalplástica S.A.",
      description: "Fabricante brasileira.",
      sameAs: [],
      knowsAbout: [],
      awards: [],
      areaServed: ["Brasil"],
      logoPath: "/images/logos/roco-2d.png",
    };

    it("tem @id estável e aponta para a URL canônica e o logo absoluto", () => {
      const org = buildOrganization(base);
      expect(org["@id"]).toBe(ORGANIZATION_ID);
      expect(ORGANIZATION_ID).toBe(absoluteUrl("/#organization"));
      expect(org.url).toBe(absoluteUrl("/"));
      expect(org.logo).toBe(absoluteUrl("/images/logos/roco-2d.png"));
      expect(org["@type"]).toBe("Organization");
      expect(org["@context"]).toBe("https://schema.org");
    });

    it("não contém campos vazios, undefined ou listas vazias", () => {
      const org = buildOrganization(base);
      assertNoEmptyValues(org);
      expect(org).not.toHaveProperty("sameAs");
      expect(org).not.toHaveProperty("knowsAbout");
      expect(org).not.toHaveProperty("award");
      expect(org).not.toHaveProperty("telephone");
      expect(org).not.toHaveProperty("address");
      expect(org).not.toHaveProperty("location");
    });

    it("areaServed vira lista de Country", () => {
      expect(buildOrganization({ ...base, areaServed: ["Brasil", "Paraguai"] }).areaServed).toEqual([
        { "@type": "Country", name: "Brasil" },
        { "@type": "Country", name: "Paraguai" },
      ]);
    });

    it("contactPoint só existe quando há telefone ou e-mail", () => {
      expect(buildOrganization(base)).not.toHaveProperty("contactPoint");

      const withEmail = buildOrganization({ ...base, email: "contato@roco.com.br" });
      expect(withEmail.contactPoint).toEqual([
        {
          "@type": "ContactPoint",
          contactType: "sales",
          email: "contato@roco.com.br",
          availableLanguage: ["Portuguese"],
          areaServed: "BR",
        },
      ]);
      expect(withEmail).not.toHaveProperty("contactPoint.0.telephone");

      const withPhone = buildOrganization({ ...base, phone: "4733352012" });
      expect(withPhone.contactPoint?.[0]).toMatchObject({ telephone: "+554733352012" });
      expect(withPhone.telephone).toBe("+554733352012");
    });

    it("telefone inválido (curto) não gera telephone nem contactPoint", () => {
      const org = buildOrganization({ ...base, phone: "123" });
      expect(org).not.toHaveProperty("telephone");
      expect(org).not.toHaveProperty("contactPoint");
    });

    it("endereço da matriz vira PostalAddress; unidade fabril vira Place", () => {
      const org = buildOrganization({
        ...base,
        addressHeadquarters: "Rua Amsterdam, 853 - Itoupavazinha, Blumenau - SC, CEP 89070-490",
        plantName: "Unidade fabril da ROCO em Gaspar (SC)",
        plantDescription: "Produção",
      });
      expect(org.address).toMatchObject({ "@type": "PostalAddress", addressLocality: "Blumenau" });
      expect(org.location).toEqual({
        "@type": "Place",
        name: "Unidade fabril da ROCO em Gaspar (SC)",
        description: "Produção",
      });
    });
  });

  describe("buildWebSite", () => {
    it("traz SearchAction com urlTemplate do catálogo", () => {
      const site = buildWebSite({ name: "ROCO", locale: "pt", searchPath: "/pt/produtos", languages: ["pt-BR", "en"] });
      expect(site["@id"]).toBe(WEBSITE_ID);
      expect(site.publisher).toEqual({ "@id": ORGANIZATION_ID });
      expect(site.potentialAction).toEqual({
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${absoluteUrl("/pt/produtos")}?search={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      });
      expect(site.inLanguage).toEqual(["pt-BR", "en"]);
    });

    it("o placeholder {search_term_string} sobrevive à serialização", () => {
      const site = buildWebSite({ name: "ROCO", locale: "pt", searchPath: "/pt/produtos", languages: ["pt-BR"] });
      expect(serializeJsonLd(site)).toContain("{search_term_string}");
    });
  });

  describe("buildBreadcrumbList", () => {
    it("numera as posições a partir de 1 e monta URLs absolutas", () => {
      const list = buildBreadcrumbList([
        { name: "Início", path: "/pt" },
        { name: "Produtos", path: "/pt/produtos" },
        { name: "Gás", path: "/pt/produtos?category=gas" },
      ]);
      expect(list.itemListElement).toEqual([
        { "@type": "ListItem", position: 1, name: "Início", item: absoluteUrl("/pt") },
        { "@type": "ListItem", position: 2, name: "Produtos", item: absoluteUrl("/pt/produtos") },
        { "@type": "ListItem", position: 3, name: "Gás", item: absoluteUrl("/pt/produtos?category=gas") },
      ]);
      expect(list["@type"]).toBe("BreadcrumbList");
    });

    it("lista vazia gera itemListElement vazio sem quebrar", () => {
      expect(buildBreadcrumbList([]).itemListElement).toEqual([]);
    });
  });

  describe("buildItemList", () => {
    it("numberOfItems acompanha a lista e itens sem imagem não ganham a chave", () => {
      const list = buildItemList({
        name: "Produtos",
        items: [
          { name: "A", path: "/pt/produtos/a", image: "https://x.test/a.jpg" },
          { name: "B", path: "/pt/produtos/b" },
        ],
      });
      expect(list.numberOfItems).toBe(2);
      expect(list.itemListElement[0]).toEqual({
        "@type": "ListItem",
        position: 1,
        name: "A",
        url: absoluteUrl("/pt/produtos/a"),
        image: "https://x.test/a.jpg",
      });
      expect(list.itemListElement[1]).not.toHaveProperty("image");
      expect(list.itemListElement[1]).toMatchObject({ position: 2, url: absoluteUrl("/pt/produtos/b") });
    });
  });

  describe("buildProduct", () => {
    const base = {
      name: "Válvula de caixa acoplada",
      description: "Descrição",
      sku: "1234",
      ean: null,
      path: "/pt/produtos/valvula-caixa",
      images: ["https://img.test/1.png"],
      categories: ["Hidrossanitários", "Caixa acoplada"],
      packagings: [{ label: "Blister — 12 unidades por embalagem" }],
      locale: "pt",
    };

    it("não tem offers (site sem preço público)", () => {
      expect(buildProduct(base)).not.toHaveProperty("offers");
    });

    it("tem @id derivado da URL, marca ROCO e fabricante por referência", () => {
      const product = buildProduct(base);
      expect(product["@id"]).toBe(`${absoluteUrl("/pt/produtos/valvula-caixa")}#product`);
      expect(product.brand).toEqual({ "@type": "Brand", name: "ROCO" });
      expect(product.manufacturer).toEqual({ "@id": ORGANIZATION_ID });
      expect(product.mpn).toBe("1234");
      expect(product.sku).toBe("1234");
      expect(product.category).toBe("Hidrossanitários > Caixa acoplada");
    });

    it("gtin13 só aparece com EAN válido", () => {
      expect(buildProduct({ ...base, ean: "7891234567895" }).gtin13).toBe("7891234567895");
      expect(buildProduct({ ...base, ean: "7891234567890" })).not.toHaveProperty("gtin13");
      expect(buildProduct({ ...base, ean: null })).not.toHaveProperty("gtin13");
    });

    it("embalagem vira PropertyValue; identifier/propertyID só com EAN válido", () => {
      const product = buildProduct({
        ...base,
        packagings: [
          { label: "Blister — 12 unidades", ean: "7891234567895" },
          { label: "Peça avulsa", ean: "7891234567890" },
          { label: "Caixa — 50 unidades" },
        ],
      });
      const [withEan, invalidEan, withoutEan] = product.additionalProperty as Record<string, unknown>[];
      expect(withEan).toEqual({
        "@type": "PropertyValue",
        name: "Embalagem",
        value: "Blister — 12 unidades",
        propertyID: "gtin13",
        identifier: "7891234567895",
      });
      expect(invalidEan).toEqual({ "@type": "PropertyValue", name: "Embalagem", value: "Peça avulsa" });
      expect(withoutEan).toEqual({ "@type": "PropertyValue", name: "Embalagem", value: "Caixa — 50 unidades" });
    });

    it("selo de campeão entra como PropertyValue 'Selo'", () => {
      const product = buildProduct({ ...base, bestSellerLabel: "Campeão de vendas" });
      expect(product.additionalProperty).toContainEqual({
        "@type": "PropertyValue",
        name: "Selo",
        value: "Campeão de vendas",
      });
    });

    it("sem embalagens nem selo, additionalProperty some", () => {
      const product = buildProduct({ ...base, packagings: [] });
      expect(product).not.toHaveProperty("additionalProperty");
    });

    it("não contém campos vazios e description null vira ausente", () => {
      const product = buildProduct({ ...base, description: null, categories: [], images: [] });
      expect(product).not.toHaveProperty("description");
      expect(product).not.toHaveProperty("category");
      expect(product).not.toHaveProperty("image");
      assertNoEmptyValues(product);
    });
  });
});
