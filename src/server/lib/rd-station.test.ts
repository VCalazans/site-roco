import { describe, it, expect } from "vitest";
import {
  buildRdStationConversionPayload,
  classifyRdStationValidationError,
  hasCustomFields,
  stripCustomFields,
  buildCartProductsSummary,
  buildMessageSummary,
  MESSAGE_MAX_LENGTH,
  CART_SUMMARY_MAX_LENGTH,
  type RdStationConversionMeta,
} from "./rd-station";
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
  message: "Preciso de orçamento.",
  productSlug: "valvula-esfera",
  locale: "pt",
  consent: true,
  ...overrides,
});

const createMeta = (overrides?: Partial<RdStationConversionMeta>): RdStationConversionMeta => ({
  clientTrackingId: "uuid-123-456-789",
  productName: "Válvula Esfera DN 25",
  productSku: "VP-25-001",
  ...overrides,
});

describe("buildRdStationConversionPayload", () => {
  describe("conversion_identifier", () => {
    it("maps 'quote' subject to 'orcamento_produto'", () => {
      const input = createContactInput({ subject: "quote" });
      const meta = createMeta();
      const payload = buildRdStationConversionPayload(input, meta);

      expect(payload.payload.conversion_identifier).toBe("orcamento_produto");
    });

    it("maps 'call_back' subject to 'ligamos_pra_voce'", () => {
      const input = createContactInput({ subject: "call_back" });
      const meta = createMeta();
      const payload = buildRdStationConversionPayload(input, meta);

      expect(payload.payload.conversion_identifier).toBe("ligamos_pra_voce");
    });

    it("maps 'catalog' subject to 'download_catalogo'", () => {
      const input = createContactInput({ subject: "catalog" });
      const meta = createMeta();
      const payload = buildRdStationConversionPayload(input, meta);

      expect(payload.payload.conversion_identifier).toBe("download_catalogo");
    });

    it("gives every subject its own identifier", () => {
      const identifiers = (["quote", "catalog", "call_back", "general"] as const).map(
        (subject) =>
          buildRdStationConversionPayload(createContactInput({ subject }), createMeta()).payload
            .conversion_identifier
      );

      expect(new Set(identifiers).size).toBe(identifiers.length);
    });

    it("maps 'general' subject to 'contato_geral'", () => {
      const input = createContactInput({ subject: "general" });
      const meta = createMeta();
      const payload = buildRdStationConversionPayload(input, meta);

      expect(payload.payload.conversion_identifier).toBe("contato_geral");
    });
  });

  describe("required conversion fields", () => {
    it("includes event_type as 'CONVERSION'", () => {
      const input = createContactInput();
      const meta = createMeta();
      const payload = buildRdStationConversionPayload(input, meta);

      expect(payload.event_type).toBe("CONVERSION");
    });

    it("includes event_family as 'CDP'", () => {
      const input = createContactInput();
      const meta = createMeta();
      const payload = buildRdStationConversionPayload(input, meta);

      expect(payload.event_family).toBe("CDP");
    });

    it("includes name from input", () => {
      const input = createContactInput({ name: "Maria da Silva" });
      const meta = createMeta();
      const payload = buildRdStationConversionPayload(input, meta);

      expect(payload.payload.name).toBe("Maria da Silva");
    });

    it("includes email from input", () => {
      const input = createContactInput({ email: "maria@example.com" });
      const meta = createMeta();
      const payload = buildRdStationConversionPayload(input, meta);

      expect(payload.payload.email).toBe("maria@example.com");
    });

    it("includes personal_phone from input.phone", () => {
      const input = createContactInput({ phone: "(11) 98765-4321" });
      const meta = createMeta();
      const payload = buildRdStationConversionPayload(input, meta);

      expect(payload.payload.personal_phone).toBe("(11) 98765-4321");
    });

    it("includes client_tracking_id from meta", () => {
      const input = createContactInput();
      const meta = createMeta({ clientTrackingId: "tracking-abc-123" });
      const payload = buildRdStationConversionPayload(input, meta);

      expect(payload.payload.client_tracking_id).toBe("tracking-abc-123");
    });
  });

  describe("conditional company_name field", () => {
    it("includes company_name when provided in input", () => {
      const input = createContactInput({ companyName: "Empresa Ltda" });
      const meta = createMeta();
      const payload = buildRdStationConversionPayload(input, meta);

      expect(payload.payload).toHaveProperty("company_name");
      expect(payload.payload.company_name).toBe("Empresa Ltda");
    });

    it("excludes company_name key when not provided in input", () => {
      const input = createContactInput({ companyName: undefined });
      const meta = createMeta();
      const payload = buildRdStationConversionPayload(input, meta);

      expect(payload.payload).not.toHaveProperty("company_name");
    });
  });

  describe("conditional cf_cnpj field", () => {
    it("includes cf_cnpj when provided in input", () => {
      const input = createContactInput({ cnpj: VALID_CNPJ });
      const meta = createMeta();
      const payload = buildRdStationConversionPayload(input, meta);

      expect(payload.payload).toHaveProperty("cf_cnpj");
      expect(payload.payload.cf_cnpj).toBe(VALID_CNPJ);
    });

    it("excludes cf_cnpj key when not provided in input", () => {
      const input = createContactInput({ cnpj: undefined });
      const meta = createMeta();
      const payload = buildRdStationConversionPayload(input, meta);

      expect(payload.payload).not.toHaveProperty("cf_cnpj");
    });
  });

  describe("conditional cf_produto_interesse field", () => {
    it("includes cf_produto_interesse with both product name and SKU when provided", () => {
      const input = createContactInput();
      const meta = createMeta({
        productName: "Válvula Esfera DN 25",
        productSku: "VP-25-001",
      });
      const payload = buildRdStationConversionPayload(input, meta);

      expect(payload.payload).toHaveProperty("cf_produto_interesse");
      expect(payload.payload.cf_produto_interesse).toBe(
        "Válvula Esfera DN 25 — SKU VP-25-001"
      );
    });

    it("includes cf_produto_interesse with only product name when SKU is missing", () => {
      const input = createContactInput();
      const meta = createMeta({
        productName: "Válvula Esfera DN 25",
        productSku: undefined,
      });
      const payload = buildRdStationConversionPayload(input, meta);

      expect(payload.payload).toHaveProperty("cf_produto_interesse");
      expect(payload.payload.cf_produto_interesse).toBe("Válvula Esfera DN 25");
    });

    it("excludes cf_produto_interesse key when product name is not provided", () => {
      const input = createContactInput();
      const meta = createMeta({ productName: undefined, productSku: undefined });
      const payload = buildRdStationConversionPayload(input, meta);

      expect(payload.payload).not.toHaveProperty("cf_produto_interesse");
    });

    it("does not include SKU in formato when product name is empty but SKU is present", () => {
      // The function checks productName first; if it's falsy, the whole field is undefined
      const input = createContactInput();
      const meta = createMeta({
        productName: undefined,
        productSku: "VP-25-001",
      });
      const payload = buildRdStationConversionPayload(input, meta);

      expect(payload.payload).not.toHaveProperty("cf_produto_interesse");
    });
  });

  describe("legal_bases and consent status", () => {
    it("sets legal_bases status to 'granted' when consent is true", () => {
      const input = createContactInput({ consent: true });
      const meta = createMeta();
      const payload = buildRdStationConversionPayload(input, meta);

      expect(payload.payload.legal_bases).toHaveLength(1);
      expect(payload.payload.legal_bases[0].category).toBe("communications");
      expect(payload.payload.legal_bases[0].type).toBe("consent");
      expect(payload.payload.legal_bases[0].status).toBe("granted");
    });

    it("sets legal_bases status to 'declined' when consent is false", () => {
      const input = createContactInput({ consent: false as unknown as true });
      const meta = createMeta();
      const payload = buildRdStationConversionPayload(input, meta);

      // Só "granted"/"declined" existem no enum documentado — um valor fora
      // dele arriscaria um 400, que derruba a conversão inteira.
      expect(payload.payload.legal_bases[0].status).toBe("declined");
    });
  });

  describe("payload structure", () => {
    it("returns a valid RdStationConversionPayload object", () => {
      const input = createContactInput();
      const meta = createMeta();
      const payload = buildRdStationConversionPayload(input, meta);

      expect(payload).toHaveProperty("event_type");
      expect(payload).toHaveProperty("event_family");
      expect(payload).toHaveProperty("payload");
      expect(typeof payload.payload).toBe("object");
    });

    it("payload contains all required top-level keys", () => {
      const input = createContactInput();
      const meta = createMeta();
      const payload = buildRdStationConversionPayload(input, meta);

      expect(payload.payload).toHaveProperty("conversion_identifier");
      expect(payload.payload).toHaveProperty("name");
      expect(payload.payload).toHaveProperty("email");
      expect(payload.payload).toHaveProperty("personal_phone");
      expect(payload.payload).toHaveProperty("client_tracking_id");
      expect(payload.payload).toHaveProperty("legal_bases");
    });
  });

  describe("edge cases", () => {
    it("handles empty product name (undefined)", () => {
      const input = createContactInput();
      const meta = createMeta({ productName: undefined });
      const payload = buildRdStationConversionPayload(input, meta);

      // Should not include the key at all
      expect(Object.keys(payload.payload)).not.toContain("cf_produto_interesse");
    });

    it("handles all optional fields as undefined", () => {
      const input = createContactInput({
        companyName: undefined,
        cnpj: undefined,
        message: undefined,
        productSlug: undefined,
      });
      const meta = createMeta({ productName: undefined, productSku: undefined });
      const payload = buildRdStationConversionPayload(input, meta);

      // Payload should still be valid with only required fields
      expect(payload.payload.name).toBe("João Silva");
      expect(payload.payload.email).toBe("joao@example.com");
      expect(payload.payload.personal_phone).toBe(VALID_PHONE);
      expect(payload.payload).not.toHaveProperty("company_name");
      expect(payload.payload).not.toHaveProperty("cf_cnpj");
      expect(payload.payload).not.toHaveProperty("cf_produto_interesse");
    });

    it("preserves special characters in product name and SKU", () => {
      const input = createContactInput();
      const meta = createMeta({
        productName: "Válvula Esfera DN 25 (Premium)",
        productSku: "VP-25-001-X/Y",
      });
      const payload = buildRdStationConversionPayload(input, meta);

      expect(payload.payload.cf_produto_interesse).toBe(
        "Válvula Esfera DN 25 (Premium) — SKU VP-25-001-X/Y"
      );
    });
  });

  describe("all subjects mapped correctly", () => {
    const subjects: Array<"quote" | "call_back" | "general" | "catalog"> = [
      "quote",
      "call_back",
      "general",
      "catalog",
    ];

    subjects.forEach((subject) => {
      it(`subject '${subject}' produces a valid payload`, () => {
        const input = createContactInput({ subject });
        const meta = createMeta();
        const payload = buildRdStationConversionPayload(input, meta);

        expect(payload).toHaveProperty("event_type", "CONVERSION");
        expect(payload).toHaveProperty("event_family", "CDP");
        expect(payload.payload.conversion_identifier).toBeTruthy();
      });
    });
  });
});

describe("rastreio de aquisição no payload do RD Station", () => {
  describe("cf_origem (seção interna do site)", () => {
    it("sends the origin as a CUSTOM field", () => {
      const payload = buildRdStationConversionPayload(
        createContactInput({ origin: "produto-detalhe" }),
        createMeta()
      );
      expect(payload.payload.cf_origem).toBe("produto-detalhe");
    });

    it("omits cf_origem when there is no origin", () => {
      const payload = buildRdStationConversionPayload(createContactInput(), createMeta());
      expect(payload.payload).not.toHaveProperty("cf_origem");
    });

    it("never puts the origin in traffic_source (that slot belongs to UTM)", () => {
      const payload = buildRdStationConversionPayload(
        createContactInput({ origin: "home-hero" }),
        createMeta()
      );
      expect(payload.payload).not.toHaveProperty("traffic_source");
    });
  });

  describe("traffic_* (campanha externa)", () => {
    it("maps the three UTM values to the STANDARD traffic fields", () => {
      const payload = buildRdStationConversionPayload(
        createContactInput({
          utmSource: "google",
          utmMedium: "cpc",
          utmCampaign: "catalogo-2026",
        }),
        createMeta()
      );
      expect(payload.payload.traffic_source).toBe("google");
      expect(payload.payload.traffic_medium).toBe("cpc");
      expect(payload.payload.traffic_campaign).toBe("catalogo-2026");
    });

    it("omits each traffic field independently", () => {
      const payload = buildRdStationConversionPayload(
        createContactInput({ utmSource: "newsletter" }),
        createMeta()
      );
      expect(payload.payload.traffic_source).toBe("newsletter");
      expect(payload.payload).not.toHaveProperty("traffic_medium");
      expect(payload.payload).not.toHaveProperty("traffic_campaign");
    });

    it("carries origin AND campaign together without overwriting each other", () => {
      const payload = buildRdStationConversionPayload(
        createContactInput({ origin: "rodape", utmSource: "google" }),
        createMeta()
      );
      expect(payload.payload.cf_origem).toBe("rodape");
      expect(payload.payload.traffic_source).toBe("google");
    });
  });

  describe("stripCustomFields (fallback do retry gracioso)", () => {
    it("drops every custom field", () => {
      const payload = buildRdStationConversionPayload(
        createContactInput({ origin: "menu" }),
        createMeta()
      );
      const stripped = stripCustomFields(payload);

      expect(stripped.payload).not.toHaveProperty("cf_cnpj");
      expect(stripped.payload).not.toHaveProperty("cf_produto_interesse");
      expect(stripped.payload).not.toHaveProperty("cf_origem");
      expect(Object.keys(stripped.payload).some((key) => key.startsWith("cf_"))).toBe(false);
    });

    it("KEEPS the fields that matter (name, email, phone)", () => {
      const payload = buildRdStationConversionPayload(createContactInput(), createMeta());
      const stripped = stripCustomFields(payload);

      expect(stripped.payload.name).toBe("João Silva");
      expect(stripped.payload.email).toBe("joao@example.com");
      expect(stripped.payload.personal_phone).toBe(VALID_PHONE);
      expect(stripped.payload.conversion_identifier).toBe("orcamento_produto");
      expect(stripped.payload.client_tracking_id).toBe("uuid-123-456-789");
      expect(stripped.payload.legal_bases).toHaveLength(1);
    });

    it("keeps the STANDARD traffic fields (they need no panel setup)", () => {
      const payload = buildRdStationConversionPayload(
        createContactInput({ utmSource: "google", utmMedium: "cpc" }),
        createMeta()
      );
      const stripped = stripCustomFields(payload);

      expect(stripped.payload.traffic_source).toBe("google");
      expect(stripped.payload.traffic_medium).toBe("cpc");
    });

    it("preserves the envelope", () => {
      const payload = buildRdStationConversionPayload(createContactInput(), createMeta());
      const stripped = stripCustomFields(payload);

      expect(stripped.event_type).toBe("CONVERSION");
      expect(stripped.event_family).toBe("CDP");
    });

    it("does not mutate the original payload", () => {
      const payload = buildRdStationConversionPayload(createContactInput(), createMeta());
      stripCustomFields(payload);
      expect(payload.payload.cf_cnpj).toBe(VALID_CNPJ);
    });

    it("is a no-op on a payload that has no custom field", () => {
      const payload = buildRdStationConversionPayload(
        // `message` entra aqui desde que `cf_mensagem` passou a ser enviado
        // (2026-08-31): sem zerá-lo o payload ainda teria campo customizado.
        createContactInput({ cnpj: undefined, message: undefined }),
        createMeta({ productName: undefined, productSku: undefined })
      );
      expect(hasCustomFields(payload)).toBe(false);
      expect(stripCustomFields(payload)).toEqual(payload);
    });
  });

  describe("hasCustomFields", () => {
    it("is true when any custom field is present", () => {
      const payload = buildRdStationConversionPayload(createContactInput(), createMeta());
      expect(hasCustomFields(payload)).toBe(true);
    });

    it("is true when only the origin is custom", () => {
      const payload = buildRdStationConversionPayload(
        createContactInput({ cnpj: undefined, origin: "menu" }),
        createMeta({ productName: undefined, productSku: undefined })
      );
      expect(hasCustomFields(payload)).toBe(true);
    });

    it("is false after stripping", () => {
      const payload = buildRdStationConversionPayload(createContactInput(), createMeta());
      expect(hasCustomFields(stripCustomFields(payload))).toBe(false);
    });
  });

  describe("classifyRdStationValidationError", () => {
    it("classifies INVALID_FIELDS in the ARRAY form of the body", () => {
      const body = {
        errors: [
          {
            error_type: "INVALID_FIELDS",
            error_message: "Payload contains fields that do not exist: (cf_origem)",
          },
        ],
      };
      expect(classifyRdStationValidationError(body)).toBe("custom_field");
    });

    it("classifies INVALID_FIELDS in the OBJECT form of the body", () => {
      const body = {
        errors: {
          error_type: "INVALID_FIELDS",
          error_message: "Payload contains fields that do not exist: (cf_origem)",
        },
      };
      expect(classifyRdStationValidationError(body)).toBe("custom_field");
    });

    it("classifies by a path pointing at a custom field", () => {
      const body = { errors: [{ error_type: "CANNOT_BE_NULL", path: "cf_produto_interesse" }] };
      expect(classifyRdStationValidationError(body)).toBe("custom_field");
    });

    it("classifies by a message naming a custom field", () => {
      const body = { errors: [{ error_message: "unknown attribute cf_cnpj" }] };
      expect(classifyRdStationValidationError(body)).toBe("custom_field");
    });

    it("classifies an unrelated validation error as 'other'", () => {
      const body = { errors: [{ error_type: "INVALID_EMAIL", error_message: "email is invalid" }] };
      expect(classifyRdStationValidationError(body)).toBe("other");
    });

    it("classifies a custom-field error mixed with others as 'custom_field'", () => {
      const body = {
        errors: [
          { error_type: "INVALID_EMAIL", error_message: "email is invalid" },
          { error_type: "INVALID_FIELDS", error_message: "fields do not exist" },
        ],
      };
      expect(classifyRdStationValidationError(body)).toBe("custom_field");
    });

    it("returns 'unknown' for an unrecognisable body (caller still retries)", () => {
      expect(classifyRdStationValidationError(null)).toBe("unknown");
      expect(classifyRdStationValidationError(undefined)).toBe("unknown");
      expect(classifyRdStationValidationError("Bad Request")).toBe("unknown");
      expect(classifyRdStationValidationError({})).toBe("unknown");
      expect(classifyRdStationValidationError({ errors: [] })).toBe("unknown");
    });

    it("reads an error sitting loose at the root of the body", () => {
      const body = { error_type: "INVALID_FIELDS", error_message: "fields do not exist" };
      expect(classifyRdStationValidationError(body)).toBe("custom_field");
    });

    it("never throws on a hostile body", () => {
      expect(() => classifyRdStationValidationError({ errors: [null, 1, "x"] })).not.toThrow();
      expect(classifyRdStationValidationError({ errors: [null, 1, "x"] })).toBe("unknown");
    });
  });
});

describe("buildCartProductsSummary", () => {
  describe("formatting", () => {
    it("formats a single item correctly", () => {
      const items = [{ name: "Válvula Esfera", sku: "VE-001", quantity: 2 }];
      const result = buildCartProductsSummary(items);
      expect(result).toBe("SKU VE-001 - Válvula Esfera (x2)");
    });

    it("joins multiple items with '; ' separator", () => {
      const items = [
        { name: "Válvula Esfera", sku: "VE-001", quantity: 2 },
        { name: "Conector Roscado", sku: "CR-002", quantity: 1 },
      ];
      const result = buildCartProductsSummary(items);
      expect(result).toContain("; ");
      expect(result).toBe("SKU VE-001 - Válvula Esfera (x2); SKU CR-002 - Conector Roscado (x1)");
    });

    it("handles quantities correctly", () => {
      const items = [{ name: "Product", sku: "SKU", quantity: 9999 }];
      const result = buildCartProductsSummary(items);
      expect(result).toBe("SKU SKU - Product (x9999)");
    });

    it("returns empty string for empty items array", () => {
      const result = buildCartProductsSummary([]);
      expect(result).toBe("");
    });
  });

  describe("truncation", () => {
    it("does not truncate when list fits within max length", () => {
      const items = [
        { name: "Item 1", sku: "A", quantity: 1 },
        { name: "Item 2", sku: "B", quantity: 1 },
      ];
      const result = buildCartProductsSummary(items, 500);
      expect(result).not.toContain("(+ lista completa por e-mail)");
      expect(result).toBe("SKU A - Item 1 (x1); SKU B - Item 2 (x1)");
    });

    it("truncates at item boundary when list exceeds max length", () => {
      // Build a list where the second item pushes over the limit
      const items = [
        { name: "First Item With Long Name", sku: "LONG-SKU-001", quantity: 1 },
        { name: "Second Item With Long Name", sku: "LONG-SKU-002", quantity: 1 },
        { name: "Third Item With Long Name", sku: "LONG-SKU-003", quantity: 1 },
      ];
      const result = buildCartProductsSummary(items, 100);
      // Should include at least first item, then suffix
      expect(result).toContain("First Item");
      expect(result).toContain("(+ lista completa por e-mail)");
      // Should not include a partial item name
      expect(result).not.toContain("Second Item With Long Name");
    });

    it("never truncates an item name in the middle", () => {
      const items = [
        { name: "Válvula Esfera Premium Importada", sku: "VEPI-001", quantity: 1 },
        { name: "Conector Roscado Galvanizado", sku: "CRG-002", quantity: 1 },
      ];
      // Use a limit large enough for first item but not both
      const result = buildCartProductsSummary(items, 150);
      // First item should be complete (not truncated in the middle)
      if (result.includes("lista completa")) {
        // Truncation happened - verify first item is intact
        expect(result).toContain("Válvula Esfera Premium Importada (x1)");
        // Second item should not appear
        expect(result).not.toContain("Conector Roscado Galvanizado");
      } else {
        // No truncation, both fit
        expect(result).toContain("Válvula Esfera Premium Importada");
        expect(result).toContain("Conector Roscado Galvanizado");
      }
    });

    it("adds the truncation suffix when list is truncated", () => {
      const items = Array.from({ length: 10 }, (_, i) => ({
        name: `Item ${i}`,
        sku: `SKU-${i}`,
        quantity: 1,
      }));
      const result = buildCartProductsSummary(items, 100);
      expect(result).toContain("(+ lista completa por e-mail)");
    });

    it("uses the correct truncation suffix", () => {
      const items = [
        { name: "A".repeat(500), sku: "SKU", quantity: 1 },
        { name: "B".repeat(500), sku: "SKU", quantity: 1 },
      ];
      const result = buildCartProductsSummary(items, 100);
      expect(result).toMatch(/\(.*lista completa por e-mail\)$/);
    });

    it("respects custom max length parameter", () => {
      const items = Array.from({ length: 5 }, (_, i) => ({
        name: `Product ${i}`,
        sku: `P-${i}`,
        quantity: i + 1,
      }));
      const smallMax = 50;
      const largeMax = 500;
      const smallResult = buildCartProductsSummary(items, smallMax);
      const largeResult = buildCartProductsSummary(items, largeMax);
      // Smaller max should truncate more
      expect(smallResult.length).toBeLessThanOrEqual(smallMax + 30); // suffix is ~30 chars
      expect(largeResult.length).toBeLessThanOrEqual(largeMax + 30);
      // Smaller should have fewer items
      const smallCount = (smallResult.match(/ - /g) || []).length;
      const largeCount = (largeResult.match(/ - /g) || []).length;
      expect(smallCount).toBeLessThanOrEqual(largeCount);
    });

    it("defaults to CART_SUMMARY_MAX_LENGTH when max not specified", () => {
      const items = Array.from({ length: 20 }, (_, i) => ({
        name: `Item ${i}`.repeat(3), // Longish names
        sku: `SKU-${i}`,
        quantity: 1,
      }));
      const result = buildCartProductsSummary(items);
      // Should fit within the default constant
      expect(result.length).toBeLessThanOrEqual(CART_SUMMARY_MAX_LENGTH + 50); // Margin for suffix
    });

    it("handles a max length that is very small (edge case)", () => {
      const items = [
        { name: "Very Long Product Name", sku: "VLPN", quantity: 1 },
      ];
      // Max smaller than a single item
      const result = buildCartProductsSummary(items, 10);
      expect(result).toContain("(+ lista completa por e-mail)");
      // Should only have the suffix (first item didn't fit)
    });

    it("handles max length exactly matching first item (boundary)", () => {
      const item = "SKU SKU - Product (x1)"; // 21 chars
      const items = [{ name: "Product", sku: "SKU", quantity: 1 }];
      const result = buildCartProductsSummary(items, item.length);
      expect(result).toBe(item);
      expect(result).not.toContain("(+ lista completa por e-mail)");
    });

    it("preserves order of items (first items appear before truncation)", () => {
      const items = [
        { name: "First", sku: "F", quantity: 1 },
        { name: "Second", sku: "S", quantity: 1 },
        { name: "Third", sku: "T", quantity: 1 },
      ];
      const result = buildCartProductsSummary(items, 50);
      // If truncated, first item should definitely be there
      if (result.includes("(+ lista completa por e-mail)")) {
        expect(result).toContain("First");
        // Last item might not be there if truncated
      }
    });
  });

  describe("special characters and escaping", () => {
    it("preserves special characters in product names", () => {
      const items = [{ name: "Válvula (Premium)", sku: "V-P/2026", quantity: 3 }];
      const result = buildCartProductsSummary(items);
      expect(result).toContain("Válvula (Premium)");
      expect(result).toContain("V-P/2026");
    });

    it("does not escape or encode content", () => {
      const items = [{ name: "Produto & Serviço", sku: "P&S-001", quantity: 1 }];
      const result = buildCartProductsSummary(items);
      expect(result).toContain("&");
      expect(result).not.toContain("&amp;");
    });
  });

  describe("cart with metadata in payload", () => {
    it("cart payload includes the summary in cf_produtos_carrinho", () => {
      const cartItems = [
        { name: "Item 1", sku: "I1", quantity: 2 },
        { name: "Item 2", sku: "I2", quantity: 1 },
      ];
      const input = createContactInput({ subject: "cart" });
      const meta = createMeta({ cartItems });
      const payload = buildRdStationConversionPayload(input, meta);
      expect(payload.payload.cf_produtos_carrinho).toBeDefined();
      expect(payload.payload.cf_produtos_carrinho).toContain("SKU I1 - Item 1 (x2)");
      expect(payload.payload.cf_produtos_carrinho).toContain("SKU I2 - Item 2 (x1)");
    });

    it("cart payload omits cf_produtos_carrinho when cartItems is empty", () => {
      const input = createContactInput({ subject: "cart" });
      const meta = createMeta({ cartItems: [] });
      const payload = buildRdStationConversionPayload(input, meta);
      expect(payload.payload).not.toHaveProperty("cf_produtos_carrinho");
    });

    it("cart payload omits cf_produtos_carrinho when cartItems is undefined", () => {
      const input = createContactInput({ subject: "cart" });
      const meta = createMeta({ cartItems: undefined });
      const payload = buildRdStationConversionPayload(input, meta);
      expect(payload.payload).not.toHaveProperty("cf_produtos_carrinho");
    });

    it("cart conversion_identifier is 'carrinho_cotacao'", () => {
      const input = createContactInput({ subject: "cart" });
      const meta = createMeta({ cartItems: [{ name: "Item", sku: "SKU", quantity: 1 }] });
      const payload = buildRdStationConversionPayload(input, meta);
      expect(payload.payload.conversion_identifier).toBe("carrinho_cotacao");
    });
  });
});

describe("buildMessageSummary", () => {
  it("collapses newlines and repeated spaces into single spaces", () => {
    expect(buildMessageSummary("Olá,\n\nPreciso  de   orçamento.\r\nObrigado.")).toBe(
      "Olá, Preciso de orçamento. Obrigado."
    );
  });

  it("trims surrounding whitespace", () => {
    expect(buildMessageSummary("  texto  ")).toBe("texto");
  });

  it("leaves a message within the cap untouched", () => {
    const message = "Gostaria de cotar 200 unidades.";
    expect(buildMessageSummary(message)).toBe(message);
  });

  it("truncates at a word boundary and never exceeds the cap", () => {
    const message = "palavra ".repeat(400).trim();
    const result = buildMessageSummary(message);

    expect(result.length).toBeLessThanOrEqual(MESSAGE_MAX_LENGTH);
    expect(result.endsWith("… (mensagem completa por e-mail)")).toBe(true);
    // Corte no limite de palavra: nunca sobra um fragmento como "palav".
    expect(result).not.toMatch(/palav(?!ra)\w*…/);
  });

  it("respects a custom cap", () => {
    expect(buildMessageSummary("a".repeat(200), 50).length).toBeLessThanOrEqual(50);
  });
});

describe("cf_mensagem field", () => {
  it("includes cf_mensagem when the visitor wrote a message", () => {
    const payload = buildRdStationConversionPayload(
      createContactInput({ message: "Preciso de orçamento." }),
      createMeta()
    );

    expect(payload.payload.cf_mensagem).toBe("Preciso de orçamento.");
  });

  it("omits cf_mensagem entirely when there is no message", () => {
    const payload = buildRdStationConversionPayload(
      createContactInput({ message: undefined }),
      createMeta()
    );

    expect(payload.payload).not.toHaveProperty("cf_mensagem");
  });

  it("flattens a multiline message before sending", () => {
    const payload = buildRdStationConversionPayload(
      createContactInput({ message: "Linha um.\nLinha dois." }),
      createMeta()
    );

    expect(payload.payload.cf_mensagem).toBe("Linha um. Linha dois.");
  });

  it("is dropped by stripCustomFields like every other cf_ field", () => {
    const payload = buildRdStationConversionPayload(createContactInput(), createMeta());
    const stripped = stripCustomFields(payload);

    expect(stripped.payload).not.toHaveProperty("cf_mensagem");
  });
});
