import { describe, it, expect } from "vitest";
import { buildContactNotificationEmail } from "./contact-email";
import type { ContactInput } from "./contact-submit";

const VALID_CNPJ = "11.222.333/0001-81";
const VALID_PHONE = "(47) 99999-1234";

const createContactInput = (overrides?: Partial<ContactInput>): ContactInput => ({
  name: "João Silva",
  email: "joao@example.com",
  phone: VALID_PHONE,
  companyName: "Silva & Cia",
  cnpj: VALID_CNPJ,
  subject: "quote",
  message: "Preciso de orçamento para o produto.",
  productSlug: "valvula-esfera",
  locale: "pt",
  consent: true,
  ...overrides,
});

describe("buildContactNotificationEmail", () => {
  describe("email subject", () => {
    it("includes subject line in the subject field", () => {
      const input = createContactInput({ subject: "quote" });
      const result = buildContactNotificationEmail(input, {});

      expect(result.subject).toContain("Solicitação de orçamento");
    });

    it("includes the contact person name in subject", () => {
      const input = createContactInput({ name: "Maria Silva" });
      const result = buildContactNotificationEmail(input, {});

      expect(result.subject).toContain("Maria Silva");
    });

    it("includes [Site ROCO] prefix in subject", () => {
      const input = createContactInput();
      const result = buildContactNotificationEmail(input, {});

      expect(result.subject).toContain("[Site ROCO]");
    });

    it("maps 'quote' subject to 'Solicitação de orçamento'", () => {
      const input = createContactInput({ subject: "quote" });
      const result = buildContactNotificationEmail(input, {});

      expect(result.subject).toContain("Solicitação de orçamento");
    });

    it("maps 'call_back' subject to 'Ligamos pra você'", () => {
      const input = createContactInput({ subject: "call_back" });
      const result = buildContactNotificationEmail(input, {});

      expect(result.subject).toContain("Ligamos pra você");
    });

    it("maps 'general' subject to 'Contato geral'", () => {
      const input = createContactInput({ subject: "general" });
      const result = buildContactNotificationEmail(input, {});

      expect(result.subject).toContain("Contato geral");
    });
  });

  describe("email content (text field)", () => {
    it("includes the contact's name in text", () => {
      const input = createContactInput({ name: "João Silva" });
      const result = buildContactNotificationEmail(input, {});

      expect(result.text).toContain("João Silva");
    });

    it("includes the contact's email in text", () => {
      const input = createContactInput({ email: "joao@example.com" });
      const result = buildContactNotificationEmail(input, {});

      expect(result.text).toContain("joao@example.com");
    });

    it("includes the contact's phone in text", () => {
      const input = createContactInput({ phone: "(47) 99999-1234" });
      const result = buildContactNotificationEmail(input, {});

      expect(result.text).toContain("(47) 99999-1234");
    });

    it("includes the message in text when provided", () => {
      const input = createContactInput({ message: "This is my message." });
      const result = buildContactNotificationEmail(input, {});

      expect(result.text).toContain("This is my message.");
    });

    it("shows '(não informada)' placeholder when message is undefined", () => {
      const input = createContactInput({ message: undefined });
      const result = buildContactNotificationEmail(input, {});

      expect(result.text).toContain("(não informada)");
    });

    it("includes company name when provided", () => {
      const input = createContactInput({ companyName: "Silva & Cia LTDA" });
      const result = buildContactNotificationEmail(input, {});

      expect(result.text).toContain("Silva & Cia LTDA");
    });

    it("does not include company name line when not provided", () => {
      const input = createContactInput({ companyName: undefined });
      const result = buildContactNotificationEmail(input, {});

      expect(result.text).not.toContain("Empresa:");
    });

    it("includes CNPJ when provided", () => {
      const input = createContactInput({ cnpj: VALID_CNPJ });
      const result = buildContactNotificationEmail(input, {});

      expect(result.text).toContain(VALID_CNPJ);
    });

    it("does not include CNPJ line when not provided", () => {
      const input = createContactInput({ cnpj: undefined });
      const result = buildContactNotificationEmail(input, {});

      expect(result.text).not.toContain("CNPJ:");
    });

    it("includes locale in text", () => {
      const input = createContactInput({ locale: "pt" });
      const result = buildContactNotificationEmail(input, {});

      expect(result.text).toContain("pt");
      expect(result.text).toContain("Idioma:");
    });

    it("includes consent status in text", () => {
      const input = createContactInput({ consent: true });
      const result = buildContactNotificationEmail(input, {});

      expect(result.text).toContain("Consentimento LGPD");
      expect(result.text).toContain("sim");
    });

    it("includes product of interest when provided with name and SKU", () => {
      const input = createContactInput();
      const result = buildContactNotificationEmail(input, {
        productName: "Válvula Esfera DN 25",
        productSku: "VP-25-001",
      });

      expect(result.text).toContain("Válvula Esfera DN 25");
      expect(result.text).toContain("VP-25-001");
    });

    it("includes product of interest with only name when SKU is missing", () => {
      const input = createContactInput();
      const result = buildContactNotificationEmail(input, {
        productName: "Válvula Esfera DN 25",
        productSku: undefined,
      });

      expect(result.text).toContain("Válvula Esfera DN 25");
      expect(result.text).not.toContain("SKU");
    });

    it("does not include product line when product name is not provided", () => {
      const input = createContactInput();
      const result = buildContactNotificationEmail(input, {
        productName: undefined,
        productSku: undefined,
      });

      expect(result.text).not.toContain("Produto de interesse:");
    });

    it("includes 'Mensagem:' label before message content", () => {
      const input = createContactInput({ message: "Test message" });
      const result = buildContactNotificationEmail(input, {});

      expect(result.text).toContain("Mensagem:");
      expect(result.text).toContain("Test message");
    });

    it("does not contain 'undefined' or 'null' strings in text", () => {
      const input = createContactInput({
        companyName: undefined,
        cnpj: undefined,
        message: undefined,
      });
      const result = buildContactNotificationEmail(input, {
        productName: undefined,
        productSku: undefined,
      });

      expect(result.text).not.toContain("undefined");
      expect(result.text).not.toContain("null");
    });
  });

  describe("email html field", () => {
    it("wraps text content in pre tags for HTML", () => {
      const input = createContactInput();
      const result = buildContactNotificationEmail(input, {});

      expect(result.html).toContain("<pre");
      expect(result.html).toContain("</pre>");
    });

    it("includes monospace font-family in html", () => {
      const input = createContactInput();
      const result = buildContactNotificationEmail(input, {});

      expect(result.html).toContain("font-family: monospace");
    });

    it("includes white-space: pre-wrap in html styling", () => {
      const input = createContactInput();
      const result = buildContactNotificationEmail(input, {});

      expect(result.html).toContain("white-space: pre-wrap");
    });

    it("escapes HTML special characters in text content", () => {
      const input = createContactInput({
        message: "This has <script> and & characters",
      });
      const result = buildContactNotificationEmail(input, {});

      expect(result.html).toContain("&lt;script&gt;");
      expect(result.html).toContain("&amp;");
      expect(result.html).not.toContain("<script>");
    });

    it("escapes ampersand in product name", () => {
      const input = createContactInput();
      const result = buildContactNotificationEmail(input, {
        productName: "Product & Services",
      });

      expect(result.html).toContain("Product &amp; Services");
      expect(result.html).not.toContain("Product & Services");
    });

    it("preserves newlines from text in HTML pre tag", () => {
      const input = createContactInput({ message: "Line 1\nLine 2" });
      const result = buildContactNotificationEmail(input, {});

      // The HTML should contain the text with newlines preserved in the pre tag
      expect(result.html).toContain("Line 1");
      expect(result.html).toContain("Line 2");
    });
  });

  describe("minimal input", () => {
    it("builds email with only required fields", () => {
      const input = createContactInput({
        companyName: undefined,
        cnpj: undefined,
        message: undefined,
        productSlug: undefined,
      });
      const result = buildContactNotificationEmail(input, {});

      expect(result.subject).toBeTruthy();
      expect(result.text).toBeTruthy();
      expect(result.html).toBeTruthy();
      expect(result.text).toContain("João Silva");
      expect(result.text).toContain("joao@example.com");
    });
  });

  describe("complete input", () => {
    it("builds email with all fields populated", () => {
      const input = createContactInput({
        companyName: "Silva & Cia",
        cnpj: VALID_CNPJ,
        message: "Full test message",
        productSlug: "valvula-esfera",
      });
      const result = buildContactNotificationEmail(input, {
        productName: "Válvula Esfera DN 25",
        productSku: "VP-25-001",
      });

      expect(result.subject).toBeTruthy();
      expect(result.text).toBeTruthy();
      expect(result.html).toBeTruthy();

      // Verify all fields are present
      expect(result.text).toContain("João Silva");
      expect(result.text).toContain("joao@example.com");
      expect(result.text).toContain("Silva & Cia");
      expect(result.text).toContain(VALID_CNPJ);
      expect(result.text).toContain("Full test message");
      expect(result.text).toContain("Válvula Esfera DN 25");
      expect(result.text).toContain("VP-25-001");
    });
  });

  describe("return type structure", () => {
    it("returns object with subject, text, and html properties", () => {
      const input = createContactInput();
      const result = buildContactNotificationEmail(input, {});

      expect(result).toHaveProperty("subject");
      expect(result).toHaveProperty("text");
      expect(result).toHaveProperty("html");
    });

    it("all email content fields are strings", () => {
      const input = createContactInput();
      const result = buildContactNotificationEmail(input, {});

      expect(typeof result.subject).toBe("string");
      expect(typeof result.text).toBe("string");
      expect(typeof result.html).toBe("string");
    });

    it("none of the content fields are empty", () => {
      const input = createContactInput();
      const result = buildContactNotificationEmail(input, {});

      expect(result.subject.length).toBeGreaterThan(0);
      expect(result.text.length).toBeGreaterThan(0);
      expect(result.html.length).toBeGreaterThan(0);
    });
  });

  describe("edge cases", () => {
    it("handles very long message without truncating", () => {
      const longMessage = "A".repeat(1000);
      const input = createContactInput({ message: longMessage });
      const result = buildContactNotificationEmail(input, {});

      expect(result.text).toContain("A".repeat(1000));
      expect(result.text.length).toBeGreaterThan(1000);
    });

    it("handles special characters in company name", () => {
      const input = createContactInput({ companyName: "Empresa S/A & Cia" });
      const result = buildContactNotificationEmail(input, {});

      expect(result.text).toContain("Empresa S/A & Cia");
      // HTML should escape the &
      expect(result.html).toContain("&amp;");
    });

    it("handles locale 'en' correctly", () => {
      const input = createContactInput({ locale: "en" });
      const result = buildContactNotificationEmail(input, {});

      expect(result.text).toContain("en");
    });

    it("handles consent false in email (even though schema requires true)", () => {
      const input = createContactInput({ consent: false as unknown as true });
      const result = buildContactNotificationEmail(input, {});

      expect(result.text).toContain("Consentimento LGPD");
      expect(result.text).toContain("não");
    });

    it("does not have newline at end of subject", () => {
      const input = createContactInput();
      const result = buildContactNotificationEmail(input, {});

      expect(result.subject.endsWith("\n")).toBe(false);
    });
  });

  describe("specific subject types", () => {
    const subjectTypes: Array<"call_back" | "quote" | "general" | "catalog"> = [
      "call_back",
      "quote",
      "general",
      "catalog",
    ];

    subjectTypes.forEach((subject) => {
      it(`handles subject type '${subject}' correctly`, () => {
        const input = createContactInput({ subject });
        const result = buildContactNotificationEmail(input, {});

        expect(result.subject).toBeTruthy();
        expect(result.text).toBeTruthy();
        expect(result.html).toBeTruthy();
        expect(result.text).toContain(input.name);
        expect(result.text).toContain(input.email);
      });
    });
  });

  describe("HTML escaping correctness", () => {
    it("escapes < character", () => {
      const input = createContactInput({ message: "1 < 2" });
      const result = buildContactNotificationEmail(input, {});

      expect(result.html).toContain("&lt;");
      expect(result.html).not.toContain("1 < 2");
    });

    it("escapes > character", () => {
      const input = createContactInput({ message: "2 > 1" });
      const result = buildContactNotificationEmail(input, {});

      expect(result.html).toContain("&gt;");
      expect(result.html).not.toContain("2 > 1");
    });

    it("escapes & character", () => {
      const input = createContactInput({ message: "A & B" });
      const result = buildContactNotificationEmail(input, {});

      expect(result.html).toContain("&amp;");
    });

    it("escapes multiple special characters in sequence", () => {
      const input = createContactInput({ message: "A & B < C > D" });
      const result = buildContactNotificationEmail(input, {});

      expect(result.html).toContain("&amp;");
      expect(result.html).toContain("&lt;");
      expect(result.html).toContain("&gt;");
    });

    it("does not double-escape already escaped content", () => {
      // If input contains &amp;, it should be escaped to &amp;amp;
      const input = createContactInput({ message: "Already &amp; escaped" });
      const result = buildContactNotificationEmail(input, {});

      expect(result.html).toContain("&amp;amp;");
    });
  });
});

describe("buildContactNotificationEmail — origem e campanha", () => {
  describe("subject label of the new 'catalog' intent", () => {
    it("names the catalog download in the subject line", () => {
      const result = buildContactNotificationEmail(createContactInput({ subject: "catalog" }), {});
      expect(result.subject).toContain("Download do catálogo");
    });

    it("names it in the body as well", () => {
      const result = buildContactNotificationEmail(createContactInput({ subject: "catalog" }), {});
      expect(result.text).toContain("Assunto: Download do catálogo");
    });

    it("keeps the four intents distinguishable", () => {
      const labels = (["call_back", "quote", "general", "catalog"] as const).map(
        (subject) => buildContactNotificationEmail(createContactInput({ subject }), {}).subject
      );
      expect(new Set(labels).size).toBe(labels.length);
    });
  });

  describe("origin line", () => {
    it("spells out the site section in plain Portuguese", () => {
      const result = buildContactNotificationEmail(
        createContactInput({ origin: "produto-detalhe" }),
        {}
      );
      expect(result.text).toContain("Origem no site: Detalhe de produto");
    });

    it("labels the hero section", () => {
      const result = buildContactNotificationEmail(createContactInput({ origin: "home-hero" }), {});
      expect(result.text).toContain("Origem no site: Home — primeira dobra (hero)");
    });

    it("omits the line entirely when there is no origin", () => {
      const result = buildContactNotificationEmail(createContactInput(), {});
      expect(result.text).not.toContain("Origem no site");
    });

    it("never leaks the raw slug to the sales team", () => {
      const result = buildContactNotificationEmail(createContactInput({ origin: "rodape" }), {});
      expect(result.text).toContain("Origem no site: Rodapé");
      expect(result.text).not.toContain("Origem no site: rodape");
    });
  });

  describe("campaign (UTM) line", () => {
    it("renders the three UTM values on one labelled line", () => {
      const result = buildContactNotificationEmail(
        createContactInput({
          utmSource: "google",
          utmMedium: "cpc",
          utmCampaign: "catalogo-2026",
        }),
        {}
      );
      expect(result.text).toContain(
        "Campanha (UTM): origem google · mídia cpc · campanha catalogo-2026"
      );
    });

    it("renders only the parts that exist", () => {
      const result = buildContactNotificationEmail(
        createContactInput({ utmSource: "instagram" }),
        {}
      );
      expect(result.text).toContain("Campanha (UTM): origem instagram");
      expect(result.text).not.toContain("mídia");
    });

    it("omits the line entirely when there is no campaign", () => {
      const result = buildContactNotificationEmail(createContactInput(), {});
      expect(result.text).not.toContain("Campanha (UTM)");
    });

    it("shows origin and campaign as separate lines", () => {
      const result = buildContactNotificationEmail(
        createContactInput({ origin: "menu", utmSource: "google" }),
        {}
      );
      const lines = result.text.split("\n");
      expect(lines).toContain("Origem no site: Menu de navegação");
      expect(lines).toContain("Campanha (UTM): origem google");
    });

    it("escapes campaign text in the HTML body", () => {
      const result = buildContactNotificationEmail(
        createContactInput({ utmCampaign: "promo <b>2026</b>" }),
        {}
      );
      expect(result.html).toContain("&lt;b&gt;");
      expect(result.html).not.toContain("<b>2026</b>");
    });
  });
});
