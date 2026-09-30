import { describe, it, expect } from "vitest";
import {
  escapeLikePattern,
  containsPattern,
  foldAccents,
  splitSearchTerms,
  MAX_SEARCH_TERMS,
} from "./sql-like";

describe("sql-like", () => {
  describe("escapeLikePattern", () => {
    it("escapes percent sign", () => {
      const result = escapeLikePattern("50%");
      expect(result).toContain("\\");
      expect(result).toContain("50");
    });

    it("escapes underscore", () => {
      const result = escapeLikePattern("first_name");
      expect(result).toContain("\\");
      expect(result).toContain("first");
    });

    it("handles empty string", () => {
      expect(escapeLikePattern("")).toBe("");
    });

    it("leaves regular text unchanged", () => {
      expect(escapeLikePattern("hello world")).toBe("hello world");
    });

    it("escapes metacharacters", () => {
      const result = escapeLikePattern("%");
      expect(result).toContain("\\");
      const result2 = escapeLikePattern("_");
      expect(result2).toContain("\\");
    });
  });

  describe("containsPattern", () => {
    it("wraps escaped pattern in percent delimiters", () => {
      expect(containsPattern("hello")).toBe("%hello%");
    });

    it("starts and ends with percent", () => {
      const result = containsPattern("50%");
      expect(result.startsWith("%")).toBe(true);
      expect(result.endsWith("%")).toBe(true);
    });

    it("handles empty string", () => {
      expect(containsPattern("")).toBe("%%");
    });

    it("escapes and wraps", () => {
      const result = containsPattern("hello_world");
      expect(result).toMatch(/^%.*%$/);
    });
  });

  describe("foldAccents", () => {
    it("removes accents from vowels", () => {
      expect(foldAccents("café")).toBe("cafe");
      expect(foldAccents("áàâãäå")).toBe("aaaaaa");
    });

    it("removes accents from special characters", () => {
      expect(foldAccents("ç")).toBe("c");
      expect(foldAccents("ñ")).toBe("n");
      expect(foldAccents("ý")).toBe("y");
    });

    it("converts to lowercase", () => {
      expect(foldAccents("CAFÉ")).toBe("cafe");
      expect(foldAccents("Açúcar")).toBe("acucar");
    });

    it("handles mixed Portuguese text", () => {
      expect(foldAccents("Flexível para gás")).toBe("flexivel para gas");
    });

    it("handles text without accents", () => {
      expect(foldAccents("hello")).toBe("hello");
    });

    it("handles empty string", () => {
      expect(foldAccents("")).toBe("");
    });
  });

  describe("splitSearchTerms", () => {
    it("splits on whitespace", () => {
      expect(splitSearchTerms("hello world")).toEqual(["hello", "world"]);
    });

    it("handles multiple spaces", () => {
      expect(splitSearchTerms("hello    world")).toEqual(["hello", "world"]);
    });

    it("trims leading/trailing whitespace", () => {
      expect(splitSearchTerms("  hello world  ")).toEqual(["hello", "world"]);
    });

    it("filters empty terms", () => {
      expect(splitSearchTerms("hello  world")).toEqual(["hello", "world"]);
    });

    it("returns empty array for empty input", () => {
      expect(splitSearchTerms("")).toEqual([]);
      expect(splitSearchTerms("   ")).toEqual([]);
    });

    it("limits to MAX_SEARCH_TERMS", () => {
      const manyTerms = "a b c d e f g h i j k l m n o p";
      const result = splitSearchTerms(manyTerms);
      expect(result.length).toBe(MAX_SEARCH_TERMS);
    });

    it("slices excess terms", () => {
      const terms = Array.from({ length: MAX_SEARCH_TERMS + 3 }, (_, i) => String(i)).join(" ");
      const result = splitSearchTerms(terms);
      expect(result).toHaveLength(MAX_SEARCH_TERMS);
    });
  });

  describe("real-world scenarios", () => {
    it("handles Portuguese product search", () => {
      const search = "Flexível para Gás";
      const terms = splitSearchTerms(search);
      expect(terms.length).toBeLessThanOrEqual(MAX_SEARCH_TERMS);
      for (const term of terms) {
        const folded = foldAccents(term);
        expect(folded).toBeDefined();
      }
    });

    it("handles accented text folding", () => {
      const search = "conexión española";
      const terms = splitSearchTerms(search);
      expect(terms[0]).toBe("conexión");
      expect(foldAccents(terms[0])).toBe("conexion");
    });
  });
});
