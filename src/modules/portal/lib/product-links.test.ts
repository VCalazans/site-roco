import { describe, expect, it } from "vitest";
import { buildWhatsappShareUrl, productPublicPath, productPublicUrl } from "./product-links";

describe("productPublicPath", () => {
  it("usa o prefixo de locale e o segmento de produtos do site", () => {
    expect(productPublicPath("pt", "joelho-90")).toBe("/pt/produtos/joelho-90");
    expect(productPublicPath("en", "joelho-90")).toBe("/en/produtos/joelho-90");
  });

  it("codifica o slug para que caracteres de URL não vazem", () => {
    expect(productPublicPath("pt", "a/b?c#d")).toBe("/pt/produtos/a%2Fb%3Fc%23d");
  });
});

describe("productPublicUrl", () => {
  it("monta a URL absoluta a partir da origem", () => {
    expect(productPublicUrl("https://roco.com.br", "pt", "joelho-90")).toBe(
      "https://roco.com.br/pt/produtos/joelho-90"
    );
  });

  it("aceita origem com porta (ambiente local)", () => {
    expect(productPublicUrl("http://localhost:3000", "en", "luva")).toBe(
      "http://localhost:3000/en/produtos/luva"
    );
  });
});

describe("buildWhatsappShareUrl", () => {
  it("codifica a mensagem inteira, incluindo quebra de linha e URL", () => {
    const url = buildWhatsappShareUrl("Veja: Joelho 90\nhttps://roco.com.br/pt/produtos/joelho-90");
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    expect(new URL(url).searchParams.get("text")).toBe(
      "Veja: Joelho 90\nhttps://roco.com.br/pt/produtos/joelho-90"
    );
  });
});
