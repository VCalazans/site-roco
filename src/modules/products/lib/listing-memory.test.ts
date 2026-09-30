import { describe, it, expect, beforeEach } from "vitest";
import { rememberListingUrl, recallListingUrl } from "./listing-memory";

type StorageMock = {
  store: Map<string, string>;
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  clear: () => void;
};

describe("listing-memory", () => {
  let mockWindow: { sessionStorage: StorageMock };

  beforeEach(() => {
    mockWindow = {
      sessionStorage: {
        store: new Map<string, string>(),
        getItem(key: string) {
          return this.store.get(key) || null;
        },
        setItem(key: string, value: string) {
          this.store.set(key, value);
        },
        clear() {
          this.store.clear();
        },
      },
    };
    Object.defineProperty(global, "window", {
      value: mockWindow,
      writable: true,
      configurable: true,
    });
  });

  describe("rememberListingUrl", () => {
    it("stores valid listing URLs", () => {
      rememberListingUrl("/pt/produtos");
      expect(mockWindow.sessionStorage.getItem("roco:last-products-url")).toBe("/pt/produtos");
    });

    it("stores URLs with query params", () => {
      rememberListingUrl("/pt/produtos?category=gas");
      expect(mockWindow.sessionStorage.getItem("roco:last-products-url")).toBe("/pt/produtos?category=gas");
    });

    it("ignores non-matching paths", () => {
      rememberListingUrl("/pt/contato");
      expect(mockWindow.sessionStorage.getItem("roco:last-products-url")).toBeNull();
    });

    it("ignores invalid formats", () => {
      rememberListingUrl("not-a-url");
      expect(mockWindow.sessionStorage.getItem("roco:last-products-url")).toBeNull();
    });
  });

  describe("recallListingUrl", () => {
    it("returns stored URL for same locale", () => {
      rememberListingUrl("/pt/produtos?page=2");
      const result = recallListingUrl("pt", "/pt/produtos");
      expect(result).toBe("/pt/produtos?page=2");
    });

    it("returns fallback for different locale", () => {
      rememberListingUrl("/pt/produtos");
      const fallback = "/en/produtos";
      const result = recallListingUrl("en", fallback);
      expect(result).toBe(fallback);
    });

    it("returns fallback when nothing stored", () => {
      const fallback = "/pt/produtos";
      const result = recallListingUrl("pt", fallback);
      expect(result).toBe(fallback);
    });

    it("returns fallback when stored URL is invalid", () => {
      mockWindow.sessionStorage.setItem("roco:last-products-url", "invalid");
      const fallback = "/pt/produtos";
      const result = recallListingUrl("pt", fallback);
      expect(result).toBe(fallback);
    });

    it("handles storage access errors gracefully", () => {
      mockWindow.sessionStorage.getItem = () => {
        throw new Error("Storage disabled");
      };
      const fallback = "/pt/produtos";
      const result = recallListingUrl("pt", fallback);
      expect(result).toBe(fallback);
    });
  });
});
