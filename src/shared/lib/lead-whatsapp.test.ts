import { describe, expect, it } from "vitest";
import pt from "@/i18n/dictionaries/pt.json";
import {
  buildLeadWhatsappUrl,
  LEAD_WA_MAX_URL_LENGTH,
  type LeadWhatsappData,
} from "@/shared/lib/lead-whatsapp";

const NUMBER = "554733352012";
const content = pt.leadWhatsapp;

const BASE: LeadWhatsappData = {
  subject: "call_back",
  name: "Ana Souza",
  companyName: "Construtora Exemplo",
  cnpj: "11.222.333/0001-81",
  phone: "(47) 99999-1234",
  email: "ana@exemplo.com.br",
};

function textOf(url: string): string {
  const prefix = `https://wa.me/${NUMBER}?text=`;
  expect(url.startsWith(prefix)).toBe(true);
  return decodeURIComponent(url.slice(prefix.length));
}

describe("buildLeadWhatsappUrl", () => {
  it("abre com a saudação do assunto e traz os dados preenchidos", () => {
    const text = textOf(buildLeadWhatsappUrl(NUMBER, BASE, content));
    expect(text.startsWith(content.intro.call_back)).toBe(true);
    expect(text).toContain("*Nome:* Ana Souza");
    expect(text).toContain("*Empresa:* Construtora Exemplo");
    expect(text).toContain("*CNPJ:* 11.222.333/0001-81");
    expect(text).toContain("*Telefone:* (47) 99999-1234");
    expect(text).toContain("*E-mail:* ana@exemplo.com.br");
  });

  it("omite campo vazio", () => {
    const text = textOf(buildLeadWhatsappUrl(NUMBER, { ...BASE, companyName: " " }, content));
    expect(text).not.toContain("Empresa");
  });

  it("inclui produto, mensagem (em uma linha) e itens", () => {
    const text = textOf(
      buildLeadWhatsappUrl(
        NUMBER,
        {
          ...BASE,
          subject: "cart",
          product: "Válvula (SKU 1000)",
          message: "Preciso\n\nurgente",
          items: [{ name: "Registro", sku: "2000", quantity: 3 }],
        },
        content
      )
    );
    expect(text.startsWith(content.intro.cart)).toBe(true);
    expect(text).toContain("*Produto:* Válvula (SKU 1000)");
    expect(text).toContain("- Registro (SKU 2000) x3");
    expect(text).toContain("*Mensagem:* Preciso urgente");
  });

  it("corta itens do fim para caber no teto da URL e avisa quantos ficaram de fora", () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      name: `Produto com nome bem comprido número ${i}`,
      sku: String(1000 + i),
      quantity: 1,
    }));
    const url = buildLeadWhatsappUrl(NUMBER, { ...BASE, subject: "cart", items }, content);
    expect(url.length).toBeLessThanOrEqual(LEAD_WA_MAX_URL_LENGTH);
    const text = textOf(url);
    expect(text).toContain("*CNPJ:*");
    expect(text).toMatch(/\+ \d+ itens/);
  });

  it("encurta a mensagem longa sem perder os dados de contato", () => {
    const url = buildLeadWhatsappUrl(
      NUMBER,
      { ...BASE, subject: "general", message: "palavra ".repeat(800) },
      content
    );
    expect(url.length).toBeLessThanOrEqual(LEAD_WA_MAX_URL_LENGTH);
    const text = textOf(url);
    expect(text).toContain("*E-mail:* ana@exemplo.com.br");
    expect(text).toContain(content.truncated);
  });
});
