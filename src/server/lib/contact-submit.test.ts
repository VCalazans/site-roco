import { describe, expect, it } from "vitest";
import {
  contactSchema,
  CONTACT_SUBJECTS,
  SELECTABLE_CONTACT_SUBJECTS,
  HONEYPOT_FIELD,
  type ContactInput,
} from "./contact-submit";
import { LEAD_ORIGINS } from "@/shared/lib/lead-origin";

/** CNPJ numérico válido (dígitos verificadores corretos). */
const VALID_CNPJ = "11.222.333/0001-81";

/** Telefone válido com 11 dígitos (celular). */
const VALID_PHONE = "(47) 99999-1234";

const VALID_INPUT: ContactInput = {
  name: "João Silva",
  email: "joao@exemplo.com.br",
  phone: VALID_PHONE,
  companyName: "Silva & Cia LTDA",
  cnpj: VALID_CNPJ,
  subject: "quote",
  message: "Gostaria de um orçamento para o produto X.",
  productSlug: "valvula-esfera",
  locale: "pt",
  consent: true,
};

const MINIMAL_VALID_INPUT: ContactInput = {
  name: "Maria",
  email: "maria@test.com",
  phone: "(47) 3333-2012",
  subject: "general",
  locale: "pt",
  consent: true,
};

describe("contactSchema", () => {
  describe("complete valid input", () => {
    it("accepts a complete valid input and normalizes email to lowercase", () => {
      const parsed = contactSchema.parse(VALID_INPUT);
      expect(parsed.email).toBe("joao@exemplo.com.br");
      expect(parsed.cnpj).toBe(VALID_CNPJ);
      expect(parsed.subject).toBe("quote");
      expect(parsed.consent).toBe(true);
    });

    it("normalizes uppercase email to lowercase", () => {
      const input = { ...VALID_INPUT, email: "JOAO@EXEMPLO.COM.BR" };
      const parsed = contactSchema.parse(input);
      expect(parsed.email).toBe("joao@exemplo.com.br");
    });

    it("trims whitespace from name", () => {
      const input = { ...VALID_INPUT, name: "  João Silva  " };
      const parsed = contactSchema.parse(input);
      expect(parsed.name).toBe("João Silva");
    });
  });

  describe("minimal valid input", () => {
    it("accepts input with only required fields", () => {
      const parsed = contactSchema.parse(MINIMAL_VALID_INPUT);
      expect(parsed.name).toBe("Maria");
      expect(parsed.email).toBe("maria@test.com");
      expect(parsed.phone).toBe("(47) 3333-2012");
      expect(parsed.subject).toBe("general");
      expect(parsed.locale).toBe("pt");
      expect(parsed.consent).toBe(true);
      // Optional fields should be undefined
      expect(parsed.companyName).toBeUndefined();
      expect(parsed.cnpj).toBeUndefined();
      expect(parsed.message).toBeUndefined();
      expect(parsed.productSlug).toBeUndefined();
    });
  });

  describe("name field", () => {
    it("accepts a valid name", () => {
      const result = contactSchema.safeParse({
        ...VALID_INPUT,
        name: "João Silva",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty name", () => {
      const result = contactSchema.safeParse({
        ...VALID_INPUT,
        name: "",
      });
      expect(result.success).toBe(false);
    });

    it("rejects name shorter than 2 characters", () => {
      const result = contactSchema.safeParse({
        ...VALID_INPUT,
        name: "J",
      });
      expect(result.success).toBe(false);
    });

    it("rejects name longer than 200 characters", () => {
      const result = contactSchema.safeParse({
        ...VALID_INPUT,
        name: "A".repeat(201),
      });
      expect(result.success).toBe(false);
    });

    it("accepts exactly 2 characters", () => {
      const result = contactSchema.safeParse({
        ...VALID_INPUT,
        name: "AB",
      });
      expect(result.success).toBe(true);
    });

    it("accepts exactly 200 characters", () => {
      const result = contactSchema.safeParse({
        ...VALID_INPUT,
        name: "A".repeat(200),
      });
      expect(result.success).toBe(true);
    });
  });

  describe("email field", () => {
    it("accepts a valid email", () => {
      const result = contactSchema.safeParse({
        ...VALID_INPUT,
        email: "valid@example.com",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid email format", () => {
      const result = contactSchema.safeParse({
        ...VALID_INPUT,
        email: "not-an-email",
      });
      expect(result.success).toBe(false);
    });

    it("rejects email without @", () => {
      const result = contactSchema.safeParse({
        ...VALID_INPUT,
        email: "nodomain.com",
      });
      expect(result.success).toBe(false);
    });

    it("rejects email without domain", () => {
      const result = contactSchema.safeParse({
        ...VALID_INPUT,
        email: "user@",
      });
      expect(result.success).toBe(false);
    });

    it("normalizes email to lowercase", () => {
      const parsed = contactSchema.parse({
        ...VALID_INPUT,
        email: "User@EXAMPLE.COM",
      });
      expect(parsed.email).toBe("user@example.com");
    });

    it("rejects email exceeding max length (320)", () => {
      const result = contactSchema.safeParse({
        ...VALID_INPUT,
        email: `${"a".repeat(310)}@example.com`, // Well over 320
      });
      expect(result.success).toBe(false);
    });
  });

  describe("phone field", () => {
    it("accepts a valid phone with 11 digits (celular)", () => {
      const result = contactSchema.safeParse({
        ...VALID_INPUT,
        phone: "(47) 99999-1234",
      });
      expect(result.success).toBe(true);
    });

    it("accepts a valid phone with 10 digits (fixo)", () => {
      const result = contactSchema.safeParse({
        ...VALID_INPUT,
        phone: "(47) 3333-2012",
      });
      expect(result.success).toBe(true);
    });

    it("rejects phone with invalid format", () => {
      const result = contactSchema.safeParse({
        ...VALID_INPUT,
        phone: "12345",
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty phone", () => {
      const result = contactSchema.safeParse({
        ...VALID_INPUT,
        phone: "",
      });
      expect(result.success).toBe(false);
    });

    it("is mandatory (required field)", () => {
      const input = { ...VALID_INPUT };
      // @ts-expect-error intentionally missing phone
      delete input.phone;
      const result = contactSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("accepts phone with whitespace (trimmed)", () => {
      const result = contactSchema.safeParse({
        ...VALID_INPUT,
        phone: "  (47) 99999-1234  ",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("companyName field (optional)", () => {
    it("accepts a valid company name", () => {
      const parsed = contactSchema.parse({
        ...VALID_INPUT,
        companyName: "Empresa Ltda",
      });
      expect(parsed.companyName).toBe("Empresa Ltda");
    });

    it("converts empty string to undefined", () => {
      const parsed = contactSchema.parse({
        ...VALID_INPUT,
        companyName: "",
      });
      expect(parsed.companyName).toBeUndefined();
    });

    it("converts whitespace-only string to undefined", () => {
      const parsed = contactSchema.parse({
        ...VALID_INPUT,
        companyName: "   ",
      });
      expect(parsed.companyName).toBeUndefined();
    });

    it("accepts omitted company name", () => {
      const input = { ...VALID_INPUT };
      delete input.companyName;
      const parsed = contactSchema.parse(input);
      expect(parsed.companyName).toBeUndefined();
    });

    it("rejects company name longer than 200 characters", () => {
      const result = contactSchema.safeParse({
        ...VALID_INPUT,
        companyName: "A".repeat(201),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("cnpj field (optional)", () => {
    it("accepts a valid CNPJ when provided", () => {
      const parsed = contactSchema.parse({
        ...VALID_INPUT,
        cnpj: VALID_CNPJ,
      });
      expect(parsed.cnpj).toBe(VALID_CNPJ);
    });

    it("converts empty CNPJ string to undefined", () => {
      const parsed = contactSchema.parse({
        ...VALID_INPUT,
        cnpj: "",
      });
      expect(parsed.cnpj).toBeUndefined();
    });

    it("converts whitespace-only CNPJ to undefined", () => {
      const parsed = contactSchema.parse({
        ...VALID_INPUT,
        cnpj: "   ",
      });
      expect(parsed.cnpj).toBeUndefined();
    });

    it("accepts omitted CNPJ", () => {
      const input = { ...MINIMAL_VALID_INPUT };
      delete input.cnpj;
      const parsed = contactSchema.parse(input);
      expect(parsed.cnpj).toBeUndefined();
    });

    it("rejects CNPJ with invalid digit verificador", () => {
      const result = contactSchema.safeParse({
        ...VALID_INPUT,
        cnpj: "11.222.333/0001-80", // Wrong last digit
      });
      expect(result.success).toBe(false);
    });

    it("rejects CNPJ with all repeating characters", () => {
      const result = contactSchema.safeParse({
        ...VALID_INPUT,
        cnpj: "00.000.000/0000-00",
      });
      expect(result.success).toBe(false);
    });

    it("rejects CNPJ exceeding max length (18)", () => {
      const result = contactSchema.safeParse({
        ...VALID_INPUT,
        cnpj: "11.222.333/0001-81-XX",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("subject field", () => {
    it("accepts 'call_back' as subject", () => {
      const result = contactSchema.safeParse({
        ...VALID_INPUT,
        subject: "call_back",
      });
      expect(result.success).toBe(true);
    });

    it("accepts 'quote' as subject", () => {
      const result = contactSchema.safeParse({
        ...VALID_INPUT,
        subject: "quote",
      });
      expect(result.success).toBe(true);
    });

    it("accepts 'general' as subject", () => {
      const result = contactSchema.safeParse({
        ...VALID_INPUT,
        subject: "general",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid subject", () => {
      const result = contactSchema.safeParse({
        ...VALID_INPUT,
        subject: "invalid_subject",
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty subject", () => {
      const result = contactSchema.safeParse({
        ...VALID_INPUT,
        subject: "",
      });
      expect(result.success).toBe(false);
    });

    it("exposes CONTACT_SUBJECTS as the enum values", () => {
      expect(CONTACT_SUBJECTS).toEqual(["call_back", "quote", "general", "catalog"]);
    });
  });

  describe("message field (optional)", () => {
    it("accepts a valid message", () => {
      const parsed = contactSchema.parse({
        ...VALID_INPUT,
        message: "This is my message.",
      });
      expect(parsed.message).toBe("This is my message.");
    });

    it("converts empty message string to undefined", () => {
      const parsed = contactSchema.parse({
        ...VALID_INPUT,
        message: "",
      });
      expect(parsed.message).toBeUndefined();
    });

    it("converts whitespace-only message to undefined", () => {
      const parsed = contactSchema.parse({
        ...VALID_INPUT,
        message: "   ",
      });
      expect(parsed.message).toBeUndefined();
    });

    it("accepts omitted message", () => {
      const input = { ...MINIMAL_VALID_INPUT };
      delete input.message;
      const parsed = contactSchema.parse(input);
      expect(parsed.message).toBeUndefined();
    });

    it("rejects message longer than 2000 characters", () => {
      const result = contactSchema.safeParse({
        ...VALID_INPUT,
        message: "A".repeat(2001),
      });
      expect(result.success).toBe(false);
    });

    it("accepts message with exactly 2000 characters", () => {
      const result = contactSchema.safeParse({
        ...VALID_INPUT,
        message: "A".repeat(2000),
      });
      expect(result.success).toBe(true);
    });

    // O campo é um `<textarea>`: apertar Enter é o comportamento normal de
    // quem escreve um pedido de orçamento. Bloquear CR/LF aqui reprovava a
    // submissão inteira com 400 e o visitante lia "tente novamente em
    // instantes" sem ter o que corrigir. `message` só entra no CORPO do
    // e-mail (escapado, dentro de `<pre>`), nunca num cabeçalho.
    it("accepts line breaks (it is a textarea, not a header)", () => {
      const parsed = contactSchema.parse({
        ...VALID_INPUT,
        message: "Olá,\nPreciso de orçamento.\r\n\r\nObrigado.",
      });
      expect(parsed.message).toBe("Olá,\nPreciso de orçamento.\r\n\r\nObrigado.");
    });

    it("still rejects a NUL byte in the message", () => {
      const result = contactSchema.safeParse({
        ...VALID_INPUT,
        message: "Orçamento\0",
      });
      expect(result.success).toBe(false);
    });

    // A fronteira: os campos que VÃO para o cabeçalho do e-mail continuam
    // fechados a CR/LF (`name` é interpolado no Subject).
    it("keeps rejecting line breaks in fields that reach the email header", () => {
      expect(
        contactSchema.safeParse({ ...VALID_INPUT, name: "João\r\nBcc: alvo@x.com" }).success
      ).toBe(false);
      expect(
        contactSchema.safeParse({ ...VALID_INPUT, companyName: "ACME\nX: 1" }).success
      ).toBe(false);
    });
  });

  describe("productSlug field (optional)", () => {
    it("accepts a valid product slug", () => {
      const parsed = contactSchema.parse({
        ...VALID_INPUT,
        productSlug: "valvula-esfera-1234",
      });
      expect(parsed.productSlug).toBe("valvula-esfera-1234");
    });

    it("converts empty slug to undefined", () => {
      const parsed = contactSchema.parse({
        ...VALID_INPUT,
        productSlug: "",
      });
      expect(parsed.productSlug).toBeUndefined();
    });

    it("converts whitespace-only slug to undefined", () => {
      const parsed = contactSchema.parse({
        ...VALID_INPUT,
        productSlug: "   ",
      });
      expect(parsed.productSlug).toBeUndefined();
    });

    it("accepts omitted product slug", () => {
      const input = { ...MINIMAL_VALID_INPUT };
      delete input.productSlug;
      const parsed = contactSchema.parse(input);
      expect(parsed.productSlug).toBeUndefined();
    });

    it("rejects slug longer than 200 characters", () => {
      const result = contactSchema.safeParse({
        ...VALID_INPUT,
        productSlug: "A".repeat(201),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("locale field", () => {
    it("accepts 'pt' as locale", () => {
      const result = contactSchema.safeParse({
        ...VALID_INPUT,
        locale: "pt",
      });
      expect(result.success).toBe(true);
    });

    it("accepts 'en' as locale", () => {
      const result = contactSchema.safeParse({
        ...VALID_INPUT,
        locale: "en",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid locale", () => {
      const result = contactSchema.safeParse({
        ...VALID_INPUT,
        locale: "es",
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty locale", () => {
      const result = contactSchema.safeParse({
        ...VALID_INPUT,
        locale: "",
      });
      expect(result.success).toBe(false);
    });

    it("is mandatory (required field)", () => {
      const input = { ...VALID_INPUT };
      // @ts-expect-error intentionally missing locale
      delete input.locale;
      const result = contactSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe("consent field", () => {
    it("accepts literal true for consent", () => {
      const result = contactSchema.safeParse({
        ...VALID_INPUT,
        consent: true,
      });
      expect(result.success).toBe(true);
    });

    it("rejects false for consent", () => {
      const result = contactSchema.safeParse({
        ...VALID_INPUT,
        consent: false,
      });
      expect(result.success).toBe(false);
    });

    it("rejects undefined for consent", () => {
      const input = { ...VALID_INPUT };
      // @ts-expect-error intentionally undefined
      input.consent = undefined;
      const result = contactSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("rejects omitted consent", () => {
      const input = { ...VALID_INPUT };
      // @ts-expect-error intentionally omit
      delete input.consent;
      const result = contactSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("rejects 1 (truthy number) for consent", () => {
      const result = contactSchema.safeParse({
        ...VALID_INPUT,
        consent: 1 as unknown as boolean,
      });
      expect(result.success).toBe(false);
    });

    it("rejects string 'true' for consent", () => {
      const result = contactSchema.safeParse({
        ...VALID_INPUT,
        consent: "true" as unknown as boolean,
      });
      expect(result.success).toBe(false);
    });

    it("is mandatory (required field)", () => {
      const input = { ...VALID_INPUT };
      // @ts-expect-error intentionally missing consent
      delete input.consent;
      const result = contactSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe("honeypot field", () => {
    it("exposes honeypot field name", () => {
      expect(HONEYPOT_FIELD).toBe("website");
    });

    it("honeypot field is used by the route (verification)", () => {
      // This is just a reference check to ensure the constant is exported
      expect(typeof HONEYPOT_FIELD).toBe("string");
      expect(HONEYPOT_FIELD.length).toBeGreaterThan(0);
    });
  });

  describe("type inference", () => {
    it("inferred type matches the schema", () => {
      const input: ContactInput = {
        name: "Test",
        email: "test@example.com",
        phone: "(47) 99999-1234",
        subject: "quote",
        locale: "pt",
        consent: true,
      };
      const parsed = contactSchema.parse(input);
      expect(parsed).toEqual(input);
    });
  });
});

describe("contactSchema — rastreio de aquisição (origem + UTM)", () => {
  describe("origin field", () => {
    it("accepts a value from the closed list", () => {
      const parsed = contactSchema.parse({ ...VALID_INPUT, origin: "produto-detalhe" });
      expect(parsed.origin).toBe("produto-detalhe");
    });

    it("accepts every origin of the closed list", () => {
      for (const origin of LEAD_ORIGINS) {
        const parsed = contactSchema.parse({ ...VALID_INPUT, origin });
        expect(parsed.origin).toBe(origin);
      }
    });

    it("DROPS an origin outside the list instead of failing the whole lead", () => {
      const result = contactSchema.safeParse({ ...VALID_INPUT, origin: "forjada-pelo-visitante" });
      expect(result.success).toBe(true);
      expect(result.success && result.data.origin).toBeUndefined();
    });

    it("drops an origin carrying injected content", () => {
      const parsed = contactSchema.parse({ ...VALID_INPUT, origin: "menu\r\nBcc: x@y.com" });
      expect(parsed.origin).toBeUndefined();
    });

    it("drops a non-string origin", () => {
      const parsed = contactSchema.parse({ ...VALID_INPUT, origin: 42 });
      expect(parsed.origin).toBeUndefined();
    });

    it("accepts an omitted origin", () => {
      const parsed = contactSchema.parse({ ...VALID_INPUT });
      expect(parsed.origin).toBeUndefined();
    });

    it("trims whitespace around a valid origin", () => {
      const parsed = contactSchema.parse({ ...VALID_INPUT, origin: "  rodape " });
      expect(parsed.origin).toBe("rodape");
    });
  });

  describe("utm fields", () => {
    it("accepts the three standard UTM values", () => {
      const parsed = contactSchema.parse({
        ...VALID_INPUT,
        utmSource: "google",
        utmMedium: "cpc",
        utmCampaign: "catalogo-2026",
      });
      expect(parsed.utmSource).toBe("google");
      expect(parsed.utmMedium).toBe("cpc");
      expect(parsed.utmCampaign).toBe("catalogo-2026");
    });

    it("truncates a UTM value at the cap instead of rejecting the lead", () => {
      const result = contactSchema.safeParse({ ...VALID_INPUT, utmSource: "a".repeat(400) });
      expect(result.success).toBe(true);
      expect(result.success && result.data.utmSource).toHaveLength(120);
    });

    it("drops a UTM value carrying a control character", () => {
      const parsed = contactSchema.parse({ ...VALID_INPUT, utmCampaign: "verao\r\nX: 1" });
      expect(parsed.utmCampaign).toBeUndefined();
    });

    it("converts an empty UTM value to undefined", () => {
      const parsed = contactSchema.parse({ ...VALID_INPUT, utmMedium: "   " });
      expect(parsed.utmMedium).toBeUndefined();
    });

    it("keeps origin and UTM independent of each other", () => {
      const parsed = contactSchema.parse({
        ...VALID_INPUT,
        origin: "home-hero",
        utmSource: "instagram",
      });
      expect(parsed.origin).toBe("home-hero");
      expect(parsed.utmSource).toBe("instagram");
    });
  });

  describe("catalog subject", () => {
    it("accepts the subject used by the catalog form", () => {
      const parsed = contactSchema.parse({ ...VALID_INPUT, subject: "catalog" });
      expect(parsed.subject).toBe("catalog");
    });

    it("keeps 'catalog' OUT of the visitor-selectable list", () => {
      expect(SELECTABLE_CONTACT_SUBJECTS).toEqual(["call_back", "quote", "general"]);
      expect((SELECTABLE_CONTACT_SUBJECTS as readonly string[]).includes("catalog")).toBe(false);
    });

    it("keeps every selectable subject inside the full enum", () => {
      for (const subject of SELECTABLE_CONTACT_SUBJECTS) {
        expect((CONTACT_SUBJECTS as readonly string[]).includes(subject)).toBe(true);
      }
    });
  });
});
