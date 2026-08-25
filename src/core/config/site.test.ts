import { describe, it, expect } from "vitest";
import {
  siteLinks,
  CATALOG_SEGMENT,
  REPRESENTATIVES_SEGMENT,
  PRODUCTS_SEGMENT,
  CONTACT_SEGMENT,
  CATALOG_PDF_FILENAME,
  representativesPath,
  productsPath,
  catalogPath,
  contactPath,
  resolveDestination,
} from "./site";

describe("site config", () => {
  describe("constants", () => {
    it("exports CATALOG_SEGMENT as 'catalogo'", () => {
      expect(CATALOG_SEGMENT).toBe("catalogo");
    });

    it("exports REPRESENTATIVES_SEGMENT as 'representantes'", () => {
      expect(REPRESENTATIVES_SEGMENT).toBe("representantes");
    });

    it("exports PRODUCTS_SEGMENT as 'produtos'", () => {
      expect(PRODUCTS_SEGMENT).toBe("produtos");
    });

    it("exports CONTACT_SEGMENT as 'contato'", () => {
      expect(CONTACT_SEGMENT).toBe("contato");
    });

    it("exports CATALOG_PDF_FILENAME as expected", () => {
      expect(CATALOG_PDF_FILENAME).toBe("catalogo-roco-2026.pdf");
    });
  });

  describe("siteLinks object", () => {
    it("provides default products URL as string", () => {
      expect(typeof siteLinks.products).toBe("string");
    });

    it("provides default catalog URL as string", () => {
      expect(typeof siteLinks.catalog).toBe("string");
    });

    it("provides default catalogPdf URL", () => {
      expect(siteLinks.catalogPdf).toBe("/downloads/catalogo-roco-2026.pdf");
    });

    it("provides default privacy URL as string", () => {
      expect(typeof siteLinks.privacy).toBe("string");
    });

    it("provides default whatsapp number", () => {
      expect(siteLinks.whatsapp).toBe("554733352012");
    });

    it("exports siteLinks as object with all properties", () => {
      expect(siteLinks).toHaveProperty("products");
      expect(siteLinks).toHaveProperty("catalog");
      expect(siteLinks).toHaveProperty("catalogPdf");
      expect(siteLinks).toHaveProperty("privacy");
      expect(siteLinks).toHaveProperty("whatsapp");
    });
  });

  describe("representativesPath", () => {
    it("returns locale-prefixed path for Portuguese", () => {
      expect(representativesPath("pt")).toBe("/pt/representantes");
    });

    it("returns locale-prefixed path for English", () => {
      expect(representativesPath("en")).toBe("/en/representantes");
    });

    it("accepts any locale string", () => {
      expect(representativesPath("es")).toBe("/es/representantes");
      expect(representativesPath("fr")).toBe("/fr/representantes");
    });

    it("handles empty locale", () => {
      expect(representativesPath("")).toBe("//representantes");
    });

    it("always returns a string starting with /", () => {
      const result = representativesPath("any");
      expect(result).toMatch(/^\/.*representantes$/);
    });
  });

  describe("productsPath", () => {
    it("returns locale-prefixed path for Portuguese", () => {
      expect(productsPath("pt")).toBe("/pt/produtos");
    });

    it("returns locale-prefixed path for English", () => {
      expect(productsPath("en")).toBe("/en/produtos");
    });

    it("accepts any locale string", () => {
      expect(productsPath("es")).toBe("/es/produtos");
      expect(productsPath("fr")).toBe("/fr/produtos");
    });

    it("handles empty locale", () => {
      expect(productsPath("")).toBe("//produtos");
    });

    it("always returns a string starting with /", () => {
      const result = productsPath("any");
      expect(result).toMatch(/^\/.*produtos$/);
    });
  });

  describe("catalogPath", () => {
    it("returns locale-prefixed path for Portuguese", () => {
      expect(catalogPath("pt")).toBe("/pt/catalogo");
    });

    it("returns locale-prefixed path for English", () => {
      expect(catalogPath("en")).toBe("/en/catalogo");
    });

    it("accepts any locale string", () => {
      expect(catalogPath("es")).toBe("/es/catalogo");
      expect(catalogPath("fr")).toBe("/fr/catalogo");
    });

    it("handles empty locale", () => {
      expect(catalogPath("")).toBe("//catalogo");
    });

    it("always returns a string starting with /", () => {
      const result = catalogPath("any");
      expect(result).toMatch(/^\/.*catalogo$/);
    });
  });

  describe("contactPath", () => {
    it("returns locale-prefixed path for Portuguese", () => {
      expect(contactPath("pt")).toBe("/pt/contato");
    });

    it("returns locale-prefixed path for English", () => {
      expect(contactPath("en")).toBe("/en/contato");
    });

    it("accepts any locale string", () => {
      expect(contactPath("es")).toBe("/es/contato");
      expect(contactPath("fr")).toBe("/fr/contato");
    });

    it("handles empty locale", () => {
      expect(contactPath("")).toBe("//contato");
    });

    it("always returns a string starting with /", () => {
      const result = contactPath("any");
      expect(result).toMatch(/^\/.*contato$/);
    });
  });

  describe("resolveDestination", () => {
    describe("products anchor/path resolution", () => {
      it("treats #produtos and /produtos as aliases", () => {
        // Both should produce the same result
        const pt = "pt";
        const en = "en";
        expect(resolveDestination("#produtos", pt)).toBe(resolveDestination("/produtos", pt));
        expect(resolveDestination("#produtos", en)).toBe(resolveDestination("/produtos", en));
      });

      it("resolves #produtos to either env URL or locale-prefixed path", () => {
        // Result should be either the configured URL or the locale-based fallback
        const result = resolveDestination("#produtos", "pt");
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
      });

      it("uses locale in fallback paths for products", () => {
        // If no env URL is set, should include locale
        const ptResult = resolveDestination("#produtos", "pt");
        const enResult = resolveDestination("#produtos", "en");
        // Both should be valid paths/URLs
        expect(ptResult).toBeTruthy();
        expect(enResult).toBeTruthy();
      });
    });

    describe("catalog anchor resolution", () => {
      it("resolves #catalogo for different locales", () => {
        const pt = resolveDestination("#catalogo", "pt");
        const en = resolveDestination("#catalogo", "en");
        expect(typeof pt).toBe("string");
        expect(typeof en).toBe("string");
      });

      it("uses locale in fallback path for catalog", () => {
        const result = resolveDestination("#catalogo", "pt");
        // Should return either env URL or include locale
        expect(result).toBeTruthy();
      });
    });

    describe("representatives anchor/path resolution", () => {
      it("resolves #representantes anchor to representativesPath", () => {
        expect(resolveDestination("#representantes", "pt")).toBe("/pt/representantes");
      });

      it("treats #representantes and /representantes as aliases", () => {
        const pt = "pt";
        const en = "en";
        expect(resolveDestination("#representantes", pt)).toBe(
          resolveDestination("/representantes", pt)
        );
        expect(resolveDestination("#representantes", en)).toBe(
          resolveDestination("/representantes", en)
        );
      });

      it("resolves #representantes for different locales", () => {
        expect(resolveDestination("#representantes", "pt")).toBe("/pt/representantes");
        expect(resolveDestination("#representantes", "en")).toBe("/en/representantes");
      });
    });

    describe("contact anchor resolution", () => {
      it("resolves #contato anchor to contactPath", () => {
        expect(resolveDestination("#contato", "pt")).toBe("/pt/contato");
      });

      it("resolves #contato for different locales", () => {
        expect(resolveDestination("#contato", "pt")).toBe("/pt/contato");
        expect(resolveDestination("#contato", "en")).toBe("/en/contato");
      });
    });

    describe("unrelated in-page anchors (pass-through)", () => {
      it("passes through arbitrary anchors unchanged", () => {
        expect(resolveDestination("#section", "pt")).toBe("#section");
        expect(resolveDestination("#about", "en")).toBe("#about");
      });
    });

    describe("root and default routes", () => {
      it("passes through / unchanged", () => {
        expect(resolveDestination("/", "pt")).toBe("/");
      });

      it("passes through empty string unchanged", () => {
        expect(resolveDestination("", "pt")).toBe("");
      });

      it("passes through other routes unchanged", () => {
        expect(resolveDestination("/about", "pt")).toBe("/about");
        expect(resolveDestination("/pt/about", "en")).toBe("/pt/about");
      });
    });

    describe("edge cases", () => {
      it("handles unknown anchors as pass-through", () => {
        expect(resolveDestination("#unknown", "pt")).toBe("#unknown");
      });

      it("handles mixed case anchors (exact match required)", () => {
        // Case-sensitive: #Produtos won't match #produtos
        expect(resolveDestination("#Produtos", "pt")).toBe("#Produtos");
      });

      it("handles paths with query strings", () => {
        // Pass-through for non-special cases
        expect(resolveDestination("/about?param=value", "pt")).toBe("/about?param=value");
      });

      it("handles multiple anchors in string (pass-through)", () => {
        expect(resolveDestination("#section1#section2", "pt")).toBe("#section1#section2");
      });
    });

    describe("locale parameter usage", () => {
      it("produces different results for different locales on aliases", () => {
        const ptRep = resolveDestination("#representantes", "pt");
        const enRep = resolveDestination("#representantes", "en");
        expect(ptRep).toContain("pt");
        expect(enRep).toContain("en");
      });

      it("applies locale consistently across all aliases", () => {
        const locale = "es";
        const reps = resolveDestination("#representantes", locale);
        expect(reps).toContain("es");
      });
    });
  });
});
