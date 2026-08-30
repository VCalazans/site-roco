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

    describe('"Ligamos pra você" (#ligamos)', () => {
      it("resolve para a página de contato do locale, com o assunto pré-selecionado", () => {
        expect(resolveDestination("#ligamos", "pt")).toBe(
          "/pt/contato?assunto=call_back"
        );
      });

      it("usa o MESMO segmento nos dois locales (não existe /en/contact)", () => {
        expect(resolveDestination("#ligamos", "en")).toBe(
          "/en/contato?assunto=call_back"
        );
      });

      it("ainda recebe a origem, apesar de já chegar com querystring", () => {
        // Regressão: `capturesLeads` comparava a string inteira contra
        // `contactPath(locale)` e este destino cairia fora.
        expect(resolveDestination("#ligamos", "pt", "menu")).toBe(
          "/pt/contato?assunto=call_back&origem=menu"
        );
      });

      it("é uma rota interna (não abre em nova aba nem some do locale)", () => {
        for (const locale of ["pt", "en"]) {
          const href = resolveDestination("#ligamos", locale, "menu");
          expect(href.startsWith(`/${locale}/`)).toBe(true);
          expect(href).not.toContain("/contact");
        }
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

describe("resolveDestination — origem de lead (3º parâmetro)", () => {
  describe("destinos que capturam lead", () => {
    it("tags the contact page with the origin", () => {
      expect(resolveDestination("#contato", "pt", "menu")).toBe("/pt/contato?origem=menu");
    });

    it("tags the contact page in every locale", () => {
      expect(resolveDestination("#contato", "en", "rodape")).toBe("/en/contato?origem=rodape");
    });

    it("tags the catalog page when it falls back to the internal route", () => {
      const destination = resolveDestination("#catalogo", "pt", "home-hero");
      // Só vale quando NEXT_PUBLIC_CATALOG_URL está vazia (padrão do repo).
      if (siteLinks.catalog) {
        expect(destination).toBe(siteLinks.catalog);
      } else {
        expect(destination).toBe("/pt/catalogo?origem=home-hero");
      }
    });

    it("treats /contato as an alias of #contato", () => {
      expect(resolveDestination("/contato", "pt", "menu")).toBe(
        resolveDestination("#contato", "pt", "menu")
      );
    });

    it("treats /catalogo as an alias of #catalogo", () => {
      expect(resolveDestination("/catalogo", "pt", "rodape")).toBe(
        resolveDestination("#catalogo", "pt", "rodape")
      );
    });

    it("locale-prefixes the bare /contato spelling (it used to link locale-less)", () => {
      expect(resolveDestination("/contato", "en")).toBe("/en/contato");
    });
  });

  describe("destinos que NÃO capturam lead", () => {
    it("leaves the home untouched", () => {
      expect(resolveDestination("/", "pt", "menu")).toBe("/");
    });

    it("leaves the product listing untouched", () => {
      expect(resolveDestination("#produtos", "pt", "menu")).toBe(
        resolveDestination("#produtos", "pt")
      );
      expect(resolveDestination("#produtos", "pt", "menu")).not.toContain("origem=");
    });

    it("leaves the representatives page untouched", () => {
      expect(resolveDestination("#representantes", "pt", "home-portal")).toBe(
        "/pt/representantes"
      );
    });

    it("leaves an unrelated anchor untouched", () => {
      expect(resolveDestination("#section", "pt", "menu")).toBe("#section");
    });

    it("leaves an arbitrary route untouched", () => {
      expect(resolveDestination("/pt/sobre", "pt", "menu")).toBe("/pt/sobre");
    });

    it("leaves an external URL untouched (never leaks internal taxonomy)", () => {
      expect(resolveDestination("https://exemplo.com/catalogo.pdf", "pt", "rodape")).toBe(
        "https://exemplo.com/catalogo.pdf"
      );
    });
  });

  describe("compatibilidade da assinatura", () => {
    it("behaves exactly as before when the origin is omitted", () => {
      for (const href of ["#contato", "#catalogo", "#produtos", "#representantes", "/", "/x"]) {
        expect(resolveDestination(href, "pt", undefined)).toBe(resolveDestination(href, "pt"));
      }
    });

    it("never appends the param twice", () => {
      const once = resolveDestination("#contato", "pt", "menu");
      expect(resolveDestination(once, "pt", "rodape")).toBe(once);
    });

    it("produces a destination the URLSearchParams parser reads back", () => {
      const href = resolveDestination("#contato", "pt", "produto-detalhe");
      const query = new URLSearchParams(href.slice(href.indexOf("?")));
      expect(query.get("origem")).toBe("produto-detalhe");
    });
  });
});
