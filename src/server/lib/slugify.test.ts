import { describe, it, expect } from "vitest";
import { slugify } from "./slugify";

describe("slugify", () => {
  describe("basic functionality", () => {
    it("converts to lowercase", () => {
      expect(slugify("HELLO WORLD")).toBe("hello-world");
    });

    it("replaces spaces with hyphens", () => {
      expect(slugify("hello world")).toBe("hello-world");
    });

    it("handles multiple spaces", () => {
      expect(slugify("hello   world")).toBe("hello-world");
    });

    it("removes leading/trailing spaces", () => {
      expect(slugify("  hello world  ")).toBe("hello-world");
    });

    it("preserves hyphens in input", () => {
      expect(slugify("hello-world")).toBe("hello-world");
    });

    it("preserves numbers", () => {
      expect(slugify("hello 123 world")).toBe("hello-123-world");
    });
  });

  describe("accent removal (NFD normalization)", () => {
    it("removes Portuguese accents", () => {
      expect(slugify("caixa d'água")).toBe("caixa-d-agua");
    });

    it("removes acute accents", () => {
      expect(slugify("bálsamo")).toBe("balsamo");
    });

    it("removes grave accents", () => {
      expect(slugify("até lá")).toBe("ate-la");
    });

    it("removes circumflex accents", () => {
      expect(slugify("açúcar")).toBe("acucar");
    });

    it("removes tilde accents", () => {
      expect(slugify("maçã")).toBe("maca");
    });

    it("removes diaeresis", () => {
      expect(slugify("müller")).toBe("muller");
    });

    it("handles mixed accents", () => {
      expect(slugify("São José da Urtiga")).toBe("sao-jose-da-urtiga");
    });
  });

  describe("special character handling", () => {
    it("removes punctuation", () => {
      expect(slugify("hello, world!")).toBe("hello-world");
    });

    it("removes symbols (replaces with hyphens)", () => {
      expect(slugify("hello@world#test$end")).toBe("hello-world-test-end");
    });

    it("removes parentheses", () => {
      expect(slugify("hello (world)")).toBe("hello-world");
    });

    it("removes brackets", () => {
      expect(slugify("hello [world]")).toBe("hello-world");
    });

    it("removes slashes (replaces with hyphen)", () => {
      expect(slugify("hello/world")).toBe("hello-world");
    });

    it("removes backslashes (replaces with hyphen)", () => {
      expect(slugify("hello\\world")).toBe("hello-world");
    });

    it("handles consecutive special characters (single hyphen)", () => {
      expect(slugify("hello!!!world")).toBe("hello-world");
    });

    it("removes leading special characters", () => {
      expect(slugify("###hello world")).toBe("hello-world");
    });

    it("removes trailing special characters", () => {
      expect(slugify("hello world###")).toBe("hello-world");
    });
  });

  describe("length limit (200 chars)", () => {
    it("truncates at 200 characters", () => {
      const longString = "a".repeat(250);
      const result = slugify(longString);
      expect(result.length).toBe(200);
    });

    it("respects 200-char limit with hyphens", () => {
      const longString = "word ".repeat(50); // Creates long slug with hyphens
      const result = slugify(longString);
      expect(result.length).toBeLessThanOrEqual(200);
    });

    it("accepts strings shorter than 200 chars", () => {
      const mediumString = "this is a medium length string with some words";
      const result = slugify(mediumString);
      expect(result.length).toBeLessThanOrEqual(200);
    });
  });

  describe("edge cases", () => {
    it("handles empty string", () => {
      expect(slugify("")).toBe("");
    });

    it("handles whitespace only", () => {
      expect(slugify("   ")).toBe("");
    });

    it("handles single character", () => {
      expect(slugify("A")).toBe("a");
    });

    it("handles single number", () => {
      expect(slugify("5")).toBe("5");
    });

    it("handles only special characters", () => {
      expect(slugify("!!!###@@@")).toBe("");
    });

    it("handles only spaces and special characters", () => {
      expect(slugify("   !!!   ###   ")).toBe("");
    });
  });

  describe("real-world examples", () => {
    it("slugifies product name", () => {
      expect(slugify("Caixa d'Água 500L")).toBe("caixa-d-agua-500l");
    });

    it("slugifies category with special chars", () => {
      expect(slugify("CANOS/TUBULAÇÕES")).toBe("canos-tubulacoes");
    });

    it("slugifies with multiple spaces and accents", () => {
      expect(slugify("  Pré-Montado  Especial  ")).toBe("pre-montado-especial");
    });

    it("slugifies product variant", () => {
      expect(slugify("Conector (Soldável) 1/2\"")).toBe("conector-soldavel-1-2");
    });

    it("handles TOMBAK descriptor (from import)", () => {
      expect(slugify("PRODUTO - TOMBAK (descontinuado)")).toBe("produto-tombak-descontinuado");
    });
  });

  describe("no-op cases", () => {
    it("preserves already-slugified string", () => {
      const slug = "already-slugified";
      expect(slugify(slug)).toBe(slug);
    });

    it("preserves slug with numbers", () => {
      const slug = "product-sku-12345";
      expect(slugify(slug)).toBe(slug);
    });
  });
});
