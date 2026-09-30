import { describe, it, expect } from "vitest";
import { buildPaginationRange } from "./pagination";

describe("buildPaginationRange", () => {
  describe("small totals (full list)", () => {
    it("lists all pages for total <= sibling*2 + 5", () => {
      const result = buildPaginationRange(1, 7, 1);
      expect(result).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it("lists all 1 page", () => {
      expect(buildPaginationRange(1, 1)).toEqual([1]);
    });

    it("lists all 7 pages (boundary)", () => {
      expect(buildPaginationRange(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });
  });

  describe("large totals at start", () => {
    it("shows start pages and ellipsis at end", () => {
      const result = buildPaginationRange(1, 20);
      expect(result[0]).toBe(1);
      expect(result[result.length - 1]).toBe(20);
      expect(result).toContain("ellipsis-end");
    });
  });

  describe("large totals at end", () => {
    it("shows ellipsis at start and end pages", () => {
      const result = buildPaginationRange(20, 20);
      expect(result[0]).toBe(1);
      expect(result[result.length - 1]).toBe(20);
      expect(result).toContain("ellipsis-start");
    });
  });

  describe("large totals in middle", () => {
    it("shows ellipsis on both sides in middle", () => {
      const result = buildPaginationRange(10, 20);
      expect(result[0]).toBe(1);
      expect(result[result.length - 1]).toBe(20);
      expect(result).toContain("ellipsis-start");
      expect(result).toContain("ellipsis-end");
      expect(result.includes(10)).toBe(true);
    });
  });

  describe("siblings parameter", () => {
    it("uses default siblings=1", () => {
      const result = buildPaginationRange(5, 20);
      expect(result).toContain(5);
      expect(result).toContain(4);
      expect(result).toContain(6);
    });

    it("respects siblings=0", () => {
      const result = buildPaginationRange(5, 20, 0);
      expect(result[0]).toBe(1);
      expect(result[result.length - 1]).toBe(20);
      expect(result.includes(5)).toBe(true);
    });

    it("respects siblings=2", () => {
      const result = buildPaginationRange(5, 20, 2);
      expect(result).toContain(3);
      expect(result).toContain(4);
      expect(result).toContain(5);
      expect(result).toContain(6);
      expect(result).toContain(7);
    });
  });

  describe("clamping and validation", () => {
    it("clamps negative current page to 1", () => {
      const result = buildPaginationRange(-5, 10);
      expect(result[0]).toBe(1);
    });

    it("clamps current page over total to total", () => {
      const result = buildPaginationRange(100, 10);
      expect(result).toContain(10);
    });

    it("clamps negative total to 1", () => {
      const result = buildPaginationRange(1, -5);
      expect(result).toEqual([1]);
    });

    it("floors fractional inputs", () => {
      const result1 = buildPaginationRange(5.7, 20.3, 1.9);
      const result2 = buildPaginationRange(5, 20, 1);
      expect(result1).toEqual(result2);
    });
  });

  describe("ellipsis placement", () => {
    it("shows ellipsis-start when gap exists before siblings", () => {
      const result = buildPaginationRange(10, 20);
      const ellipsisIndex = result.indexOf("ellipsis-start");
      expect(ellipsisIndex).toBeGreaterThan(0);
    });

    it("shows ellipsis-end when gap exists after siblings", () => {
      const result = buildPaginationRange(10, 20);
      const ellipsisIndex = result.indexOf("ellipsis-end");
      expect(ellipsisIndex).toBeGreaterThan(0);
    });
  });

  describe("constant item count", () => {
    it("maintains consistent array length across navigation", () => {
      const result1 = buildPaginationRange(1, 100);
      const result2 = buildPaginationRange(50, 100);
      const result3 = buildPaginationRange(100, 100);
      expect(result1.length).toBe(result2.length);
      expect(result2.length).toBe(result3.length);
    });
  });

  describe("real-world scenarios", () => {
    it("handles page 1 of 50", () => {
      const result = buildPaginationRange(1, 50);
      expect(result[0]).toBe(1);
      expect(result[result.length - 1]).toBe(50);
    });

    it("handles page 25 of 50 (middle)", () => {
      const result = buildPaginationRange(25, 50);
      expect(result).toContain(25);
    });

    it("handles last page", () => {
      const result = buildPaginationRange(50, 50);
      expect(result[result.length - 1]).toBe(50);
      expect(result[0]).toBe(1);
    });
  });
});
