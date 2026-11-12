import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildMetaLeadEvent, normalizePhone, sanitizeSourceUrl, splitName } from "./meta-capi";

const h = (value: string) => createHash("sha256").update(value).digest("hex");

const base = {
  subject: "quote" as const,
  name: "  José da Silva ",
  email: " Jose@Empresa.com.br ",
  phone: "(47) 99999-1234",
  eventId: "11111111-2222-3333-4444-555555555555",
  nowMs: 1_700_000_000_123,
};

describe("normalizações", () => {
  it("telefone nacional ganha o DDI 55", () => {
    expect(normalizePhone("(47) 99999-1234")).toBe("5547999991234");
    expect(normalizePhone("47 3335-2012")).toBe("554733352012");
    expect(normalizePhone("+55 47 99999-1234")).toBe("5547999991234");
    expect(normalizePhone("123")).toBeUndefined();
  });

  it("nome vira primeiro e último, minúsculos e sem acento", () => {
    expect(splitName("  José da Silva ")).toEqual({ first: "jose", last: "silva" });
    expect(splitName("Ana")).toEqual({ first: "ana", last: undefined });
    expect(splitName("  ")).toEqual({});
  });

  it("URL de origem só http(s), sem fragmento", () => {
    expect(sanitizeSourceUrl("https://roco.com.br/pt/contato?assunto=quote#x")).toBe(
      "https://roco.com.br/pt/contato?assunto=quote"
    );
    expect(sanitizeSourceUrl("javascript:alert(1)")).toBeUndefined();
    expect(sanitizeSourceUrl("lixo")).toBeUndefined();
    expect(sanitizeSourceUrl(null)).toBeUndefined();
  });
});

describe("buildMetaLeadEvent", () => {
  it("monta o Lead com dados em hash e o mesmo event_id do navegador", () => {
    const event = buildMetaLeadEvent({
      ...base,
      ip: "200.1.2.3",
      userAgent: "Mozilla/5.0",
      fbp: "fb.1.1700000000000.123456789",
      fbc: "fb.1.1700000000000.IwAR1abc",
      sourceUrl: "https://roco.com.br/pt/contato",
      productSku: "1000",
    });
    expect(event).toMatchObject({
      event_name: "Lead",
      event_time: 1_700_000_000,
      event_id: base.eventId,
      action_source: "website",
      event_source_url: "https://roco.com.br/pt/contato",
      custom_data: {
        content_name: "site-contato-solicite-um-orcamento",
        content_type: "product",
        content_ids: ["1000"],
      },
    });
    expect(event.user_data).toEqual({
      em: [h("jose@empresa.com.br")],
      external_id: [h("jose@empresa.com.br")],
      country: [h("br")],
      ph: [h("5547999991234")],
      fn: [h("jose")],
      ln: [h("silva")],
      client_ip_address: "200.1.2.3",
      client_user_agent: "Mozilla/5.0",
      fbp: "fb.1.1700000000000.123456789",
      fbc: "fb.1.1700000000000.IwAR1abc",
    });
    // Nada em texto puro.
    expect(JSON.stringify(event)).not.toContain("empresa.com.br");
    expect(JSON.stringify(event)).not.toContain("99999");
  });

  it("Contact para 'Ligamos pra você', sem cookies nem IP desconhecido", () => {
    const event = buildMetaLeadEvent({ ...base, subject: "call_back", ip: "unknown", fbp: "forjado", fbc: "" });
    expect(event.event_name).toBe("Contact");
    expect(event.user_data.client_ip_address).toBeUndefined();
    expect(event.user_data.fbp).toBeUndefined();
    expect(event.user_data.fbc).toBeUndefined();
    expect(event.event_source_url).toBeUndefined();
  });

  it("lista de orçamento leva os itens em contents", () => {
    const event = buildMetaLeadEvent({
      ...base,
      subject: "cart",
      cartItems: [
        { sku: "1000", quantity: 2 },
        { sku: "1001", quantity: 3 },
      ],
    });
    expect(event.custom_data).toEqual({
      content_name: "site-orcamento-lista-de-produtos",
      content_type: "product",
      content_ids: ["1000", "1001"],
      contents: [
        { id: "1000", quantity: 2 },
        { id: "1001", quantity: 3 },
      ],
      num_items: 5,
    });
  });
});
