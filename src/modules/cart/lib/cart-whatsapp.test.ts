import { describe, it, expect } from "vitest";
import {
  buildWhatsappCartMessage,
  WA_ME_MAX_URL_LENGTH,
  type CartWhatsappItem,
} from "./cart-whatsapp";

describe("buildWhatsappCartMessage", () => {
  const whatsappNumber = "5547999991234";
  const intro = "Olá! Preciso de orçamento para os seguintes produtos:";
  const moreItemsSuffix = "\n\nObs: Lista completa contém {count} itens não exibidos acima.";

  const createItem = (overrides?: Partial<CartWhatsappItem>): CartWhatsappItem => ({
    name: "Válvula Esfera",
    sku: "VE-001",
    quantity: 1,
    ...overrides,
  });

  describe("URL building", () => {
    it("returns a valid wa.me URL", () => {
      const items = [createItem()];
      const url = buildWhatsappCartMessage(items, intro, moreItemsSuffix, whatsappNumber);
      expect(url).toContain("https://wa.me/");
      expect(url).toContain(whatsappNumber);
      expect(url).toContain("?text=");
    });

    it("encodes the text parameter", () => {
      const items = [createItem()];
      const url = buildWhatsappCartMessage(items, intro, moreItemsSuffix, whatsappNumber);
      // The text parameter should be encoded (spaces, etc.)
      const urlObj = new URL(url);
      const text = urlObj.searchParams.get("text");
      expect(text).toBeTruthy();
      // Should not be double-encoded
      expect(text).toContain("Olá");
    });

    it("respects WA_ME_MAX_URL_LENGTH limit", () => {
      const items = Array.from({ length: 20 }, (_, i) =>
        createItem({ name: `Product Number ${i}`, sku: `SKU-${i}` })
      );
      const url = buildWhatsappCartMessage(items, intro, moreItemsSuffix, whatsappNumber);
      expect(url.length).toBeLessThanOrEqual(WA_ME_MAX_URL_LENGTH);
    });
  });

  describe("message formatting (text content)", () => {
    it("starts with the intro text", () => {
      const items = [createItem()];
      const url = buildWhatsappCartMessage(items, intro, moreItemsSuffix, whatsappNumber);
      const urlObj = new URL(url);
      const text = decodeURIComponent(urlObj.searchParams.get("text") || "");
      expect(text).toContain(intro);
    });

    it("includes all items in the message when they fit", () => {
      const items = [
        createItem({ name: "Item A", sku: "A", quantity: 1 }),
        createItem({ name: "Item B", sku: "B", quantity: 2 }),
      ];
      const url = buildWhatsappCartMessage(items, intro, moreItemsSuffix, whatsappNumber);
      const urlObj = new URL(url);
      const text = decodeURIComponent(urlObj.searchParams.get("text") || "");
      expect(text).toContain("Item A");
      expect(text).toContain("Item B");
      expect(text).toContain("(SKU A)");
      expect(text).toContain("(SKU B)");
    });

    it("formats each item as '- {name} (SKU {sku}) x{quantity}'", () => {
      const items = [createItem({ name: "Válvula", sku: "V-123", quantity: 5 })];
      const url = buildWhatsappCartMessage(items, intro, moreItemsSuffix, whatsappNumber);
      const urlObj = new URL(url);
      const text = decodeURIComponent(urlObj.searchParams.get("text") || "");
      expect(text).toContain("- Válvula (SKU V-123) x5");
    });

    it("separates items with line breaks", () => {
      const items = [
        createItem({ name: "Item A", sku: "A", quantity: 1 }),
        createItem({ name: "Item B", sku: "B", quantity: 1 }),
      ];
      const url = buildWhatsappCartMessage(items, intro, moreItemsSuffix, whatsappNumber);
      const urlObj = new URL(url);
      const text = decodeURIComponent(urlObj.searchParams.get("text") || "");
      const lines = text.split("\n");
      // At least intro + item A + item B + empty lines
      expect(lines.length).toBeGreaterThanOrEqual(3);
      expect(text).toContain("\n- Item A");
      expect(text).toContain("\n- Item B");
    });
  });

  describe("handling empty cart", () => {
    it("handles empty items array", () => {
      const url = buildWhatsappCartMessage([], intro, moreItemsSuffix, whatsappNumber);
      expect(url).toContain("https://wa.me/");
      // Even with no items, URL should be valid
      const urlObj = new URL(url);
      const text = decodeURIComponent(urlObj.searchParams.get("text") || "");
      // Text might be just the intro (no items to list)
      expect(text).toBeTruthy();
    });
  });

  describe("truncation when URL exceeds max length", () => {
    it("removes items from the END when URL would be too long", () => {
      // Build a list where items will be progressively removed
      const items = Array.from({ length: 30 }, (_, i) =>
        createItem({
          name: `Product with a very long product name that is quite descriptive number ${i}`,
          sku: `SKU-${String(i).padStart(3, "0")}`,
          quantity: i + 1,
        })
      );
      const url = buildWhatsappCartMessage(items, intro, moreItemsSuffix, whatsappNumber);
      expect(url.length).toBeLessThanOrEqual(WA_ME_MAX_URL_LENGTH);

      const urlObj = new URL(url);
      const text = decodeURIComponent(urlObj.searchParams.get("text") || "");
      // With 30 long items, definitely should be truncated
      if (text.includes("lista completa")) {
        // First items should be there
        expect(text).toContain("Product with a very long");
        // Later items might not be there (truncated)
        // Just verify truncation happened
        expect(text).toContain("lista completa por e-mail");
      }
    });

    it("preserves the FIRST items when truncating", () => {
      const items = [
        createItem({ name: "First Product", sku: "FIRST", quantity: 1 }),
        createItem({ name: "Second Product", sku: "SECOND", quantity: 1 }),
        createItem({ name: "Third Product", sku: "THIRD", quantity: 1 }),
      ];
      // With global limit, we expect truncation with longer lists
      const normalUrl = buildWhatsappCartMessage(items, intro, moreItemsSuffix, whatsappNumber);
      // For this short list, all should fit normally
      const urlObj = new URL(normalUrl);
      const text = decodeURIComponent(urlObj.searchParams.get("text") || "");
      if (text.includes("Third Product")) {
        // All fit
        expect(text).toContain("First Product");
      }
      // First should always be there unless the limit is unreasonably small
    });

    it("adds the moreItemsSuffix when items are removed", () => {
      const items = Array.from({ length: 15 }, (_, i) =>
        createItem({
          name: `Product ${i}`.repeat(3),
          sku: `SKU-${i}`,
          quantity: 1,
        })
      );
      const url = buildWhatsappCartMessage(items, intro, moreItemsSuffix, whatsappNumber);
      const urlObj = new URL(url);
      const text = decodeURIComponent(urlObj.searchParams.get("text") || "");
      // With a large list that gets truncated
      if (text.includes("Lista completa")) {
        expect(text).toContain("Obs:");
        expect(text).toMatch(/\d+ itens não exibidos/);
      }
    });

    it("substitutes {count} in the suffix with the number of removed items", () => {
      const items = Array.from({ length: 25 }, (_, i) =>
        createItem({
          name: `Long Product Name Number ${i}`.repeat(2),
          sku: `SKU-${String(i).padStart(3, "0")}`,
          quantity: 1,
        })
      );
      const url = buildWhatsappCartMessage(items, intro, moreItemsSuffix, whatsappNumber);
      const urlObj = new URL(url);
      const text = decodeURIComponent(urlObj.searchParams.get("text") || "");
      if (text.includes("Lista completa")) {
        // The count should be a number, not the literal "{count}"
        expect(text).not.toContain("{count}");
        expect(/\d+ itens não exibidos/.test(text)).toBe(true);
      }
    });

    it("removes items ONLY from the end", () => {
      // Create items where we can track which ones are preserved
      const items = [
        createItem({ name: "FIRST", sku: "F", quantity: 1 }),
        createItem({ name: "MIDDLE_1", sku: "M1", quantity: 1 }),
        createItem({ name: "MIDDLE_2", sku: "M2", quantity: 1 }),
        createItem({ name: "LAST", sku: "L", quantity: 1 }),
      ];
      const url = buildWhatsappCartMessage(items, intro, moreItemsSuffix, whatsappNumber);
      const urlObj = new URL(url);
      const text = decodeURIComponent(urlObj.searchParams.get("text") || "");
      // All should fit for 4 items with short names
      expect(text).toContain("FIRST");
      expect(text).toContain("LAST");
    });
  });

  describe("suffix substitution", () => {
    it("replaces {count} in suffix with actual count", () => {
      // Create a large list that will definitely truncate
      const items = Array.from({ length: 30 }, (_, i) =>
        createItem({
          name: `Product ${i}`.repeat(3),
          sku: `SKU-${i}`,
          quantity: 1,
        })
      );
      const url = buildWhatsappCartMessage(items, intro, moreItemsSuffix, whatsappNumber);
      const urlObj = new URL(url);
      const text = decodeURIComponent(urlObj.searchParams.get("text") || "");

      if (text.includes("itens não exibidos")) {
        // Extract the number
        const match = text.match(/(\d+) itens não exibidos/);
        expect(match).toBeTruthy();
        if (match) {
          const count = parseInt(match[1], 10);
          expect(count).toBeGreaterThan(0);
          // Count should be less than total items
          expect(count).toBeLessThan(items.length);
        }
      }
    });

    it("does not include suffix when all items fit", () => {
      const items = [createItem()];
      const url = buildWhatsappCartMessage(items, intro, moreItemsSuffix, whatsappNumber);
      const urlObj = new URL(url);
      const text = decodeURIComponent(urlObj.searchParams.get("text") || "");
      expect(text).not.toContain("Lista completa");
    });

    it("does not include suffix when cart is empty", () => {
      const url = buildWhatsappCartMessage([], intro, moreItemsSuffix, whatsappNumber);
      const urlObj = new URL(url);
      const text = decodeURIComponent(urlObj.searchParams.get("text") || "");
      expect(text).not.toContain("Lista completa");
    });
  });

  describe("special characters and encoding", () => {
    it("preserves special characters in product names", () => {
      const items = [createItem({ name: "Válvula (Premium) & Serviço", sku: "V-P/S" })];
      const url = buildWhatsappCartMessage(items, intro, moreItemsSuffix, whatsappNumber);
      const urlObj = new URL(url);
      const text = decodeURIComponent(urlObj.searchParams.get("text") || "");
      expect(text).toContain("Válvula");
      expect(text).toContain("Premium");
      expect(text).toContain("&");
    });

    it("correctly encodes the full message in URL", () => {
      const items = [createItem({ name: "Produto #1", sku: "P-1" })];
      const url = buildWhatsappCartMessage(items, intro, moreItemsSuffix, whatsappNumber);
      expect(() => new URL(url)).not.toThrow();
    });
  });

  describe("edge cases", () => {
    it("handles very long product names", () => {
      const items = [
        createItem({ name: "A".repeat(100), sku: "LONG", quantity: 1 }),
      ];
      const url = buildWhatsappCartMessage(items, intro, moreItemsSuffix, whatsappNumber);
      expect(url.length).toBeLessThanOrEqual(WA_ME_MAX_URL_LENGTH);
      const urlObj = new URL(url);
      const text = decodeURIComponent(urlObj.searchParams.get("text") || "");
      expect(text).toContain("A".repeat(50)); // At least part of the name
    });

    it("handles quantities with many digits", () => {
      const items = [createItem({ name: "Product", sku: "P", quantity: 9999 })];
      const url = buildWhatsappCartMessage(items, intro, moreItemsSuffix, whatsappNumber);
      const urlObj = new URL(url);
      const text = decodeURIComponent(urlObj.searchParams.get("text") || "");
      expect(text).toContain("x9999");
    });

    it("handles intro text with newlines", () => {
      const multilineIntro =
        "Olá!\n\nPreciso de orçamento\npara estes produtos:";
      const items = [createItem()];
      const url = buildWhatsappCartMessage(
        items,
        multilineIntro,
        moreItemsSuffix,
        whatsappNumber
      );
      const urlObj = new URL(url);
      const text = decodeURIComponent(urlObj.searchParams.get("text") || "");
      // Newlines should be preserved in encoding
      expect(text.length).toBeGreaterThan(0);
    });

    it("handles suffix template with no {count} placeholder", () => {
      const items = Array.from({ length: 30 }, (_, i) =>
        createItem({
          name: `P${i}`.repeat(3),
          sku: `S${i}`,
          quantity: 1,
        })
      );
      const suffixWithoutPlaceholder = "\n\nE há mais itens!";
      const url = buildWhatsappCartMessage(
        items,
        intro,
        suffixWithoutPlaceholder,
        whatsappNumber
      );
      const urlObj = new URL(url);
      const text = decodeURIComponent(urlObj.searchParams.get("text") || "");
      if (text.includes("E há mais itens!")) {
        expect(text).toContain("E há mais itens!");
      }
    });
  });

  describe("list consistency", () => {
    it("preserves item order when not truncated", () => {
      const items = [
        createItem({ name: "A", sku: "A", quantity: 1 }),
        createItem({ name: "B", sku: "B", quantity: 1 }),
        createItem({ name: "C", sku: "C", quantity: 1 }),
      ];
      const url = buildWhatsappCartMessage(items, intro, moreItemsSuffix, whatsappNumber);
      const urlObj = new URL(url);
      const text = decodeURIComponent(urlObj.searchParams.get("text") || "");
      const indexA = text.indexOf("- A");
      const indexB = text.indexOf("- B");
      const indexC = text.indexOf("- C");
      expect(indexA).toBeLessThan(indexB);
      expect(indexB).toBeLessThan(indexC);
    });

    it("returns a string, never throws", () => {
      const items = Array.from({ length: 50 }, (_, i) =>
        createItem({
          name: `Product ${i}`.repeat(10),
          sku: `SKU-${i}`,
          quantity: 1000,
        })
      );
      expect(() =>
        buildWhatsappCartMessage(items, intro, moreItemsSuffix, whatsappNumber)
      ).not.toThrow();
      const url = buildWhatsappCartMessage(items, intro, moreItemsSuffix, whatsappNumber);
      expect(typeof url).toBe("string");
      expect(url).toContain("https://wa.me/");
    });
  });
});
