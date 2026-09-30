import { describe, expect, it } from "vitest";
import { applyAddItem, sanitizeImage } from "./cart-store";

/** Spec 001: miniatura da lista de orçamento (campo opcional `image`). */
describe("sanitizeImage", () => {
  it("aceita URL http(s) e caminho interno", () => {
    expect(sanitizeImage("https://pub.r2.dev/products/1216/a.png")).toBe("https://pub.r2.dev/products/1216/a.png");
    expect(sanitizeImage("http://localhost:3000/x.png")).toBe("http://localhost:3000/x.png");
    expect(sanitizeImage("/images/home/fachada-roco.jpg")).toBe("/images/home/fachada-roco.jpg");
  });

  it("rejeita esquemas perigosos e protocol-relative", () => {
    expect(sanitizeImage("javascript:alert(1)")).toBeUndefined();
    expect(sanitizeImage("data:image/png;base64,AAAA")).toBeUndefined();
    expect(sanitizeImage("//evil.com/x.png")).toBeUndefined();
    expect(sanitizeImage("ftp://x/y.png")).toBeUndefined();
  });

  it("rejeita o que PARECE caminho interno mas o navegador resolve para outro host", () => {
    expect(sanitizeImage("/\\evil.com/x.png")).toBeUndefined();
    expect(sanitizeImage("/\tevil.com/x.png")).toBeUndefined();
    expect(sanitizeImage("/\n/evil.com/x.png")).toBeUndefined();
    expect(sanitizeImage("/images/a b.png")).toBeUndefined();
    expect(sanitizeImage("https://x.com/a\\b.png")).toBeUndefined();
    expect(sanitizeImage("https://")).toBeUndefined();
  });

  it("rejeita não-string, texto solto e valor longo demais", () => {
    expect(sanitizeImage(undefined)).toBeUndefined();
    expect(sanitizeImage(42)).toBeUndefined();
    expect(sanitizeImage("nao-e-url")).toBeUndefined();
    expect(sanitizeImage(`https://x.com/${"a".repeat(2100)}`)).toBeUndefined();
  });
});

describe("applyAddItem — imagem", () => {
  const base = { slug: "valvula", name: "Válvula", sku: "1216" };

  it("guarda a imagem saneada quando válida", () => {
    const [item] = applyAddItem([], { ...base, image: "https://pub.r2.dev/a.png" }, 1);
    expect(item).toEqual({ ...base, quantity: 1, image: "https://pub.r2.dev/a.png" });
  });

  it("descarta imagem inválida sem perder o item", () => {
    const [item] = applyAddItem([], { ...base, image: "javascript:alert(1)" }, 2);
    expect(item).toEqual({ ...base, quantity: 2 });
    expect(item).not.toHaveProperty("image");
  });

  it("nunca carrega propriedades extras do objeto de entrada", () => {
    const polluted = { ...base, image: "/x.png", admin: true } as unknown as Parameters<typeof applyAddItem>[1];
    const [item] = applyAddItem([], polluted, 1);
    expect(Object.keys(item).sort()).toEqual(["image", "name", "quantity", "sku", "slug"]);
  });

  it("somar quantidade de item existente mantém a imagem original", () => {
    const first = applyAddItem([], { ...base, image: "/a.png" }, 1);
    const [item] = applyAddItem(first, { ...base, image: "/b.png" }, 1);
    expect(item.quantity).toBe(2);
    expect(item.image).toBe("/a.png");
  });
});
