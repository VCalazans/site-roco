import { describe, it, expect } from "vitest";
import {
  visibleNavLinks,
  siteNavLinks,
  navLabelClass,
  isNavLinkActive,
  externalProps,
  type NavLink,
} from "./nav";

describe("nav utilities", () => {
  describe("visibleNavLinks", () => {
    it("returns all links when none are hidden", () => {
      const links: NavLink[] = [
        { label: "Home", href: "/" },
        { label: "About", href: "/about" },
      ];
      expect(visibleNavLinks(links)).toEqual(links);
    });

    it("filters out links marked as hidden", () => {
      const links: NavLink[] = [
        { label: "Home", href: "/", hidden: false },
        { label: "Hidden", href: "/hidden", hidden: true },
        { label: "Visible", href: "/visible" },
      ];
      const result = visibleNavLinks(links);
      expect(result).toHaveLength(2);
      expect(result).toEqual([
        { label: "Home", href: "/", hidden: false },
        { label: "Visible", href: "/visible" },
      ]);
    });

    it("filters out all links if all are hidden", () => {
      const links: NavLink[] = [
        { label: "Hidden1", href: "/hidden1", hidden: true },
        { label: "Hidden2", href: "/hidden2", hidden: true },
      ];
      expect(visibleNavLinks(links)).toHaveLength(0);
    });

    it("returns empty array for empty input", () => {
      expect(visibleNavLinks([])).toEqual([]);
    });

    it("preserves order of visible links", () => {
      const links: NavLink[] = [
        { label: "First", href: "/first" },
        { label: "Hidden", href: "/hidden", hidden: true },
        { label: "Second", href: "/second" },
        { label: "Third", href: "/third" },
      ];
      const result = visibleNavLinks(links);
      expect(result.map((l) => l.label)).toEqual(["First", "Second", "Third"]);
    });

    it("treats undefined hidden as visible", () => {
      const links: NavLink[] = [
        { label: "No hidden prop", href: "/" },
        { label: "Explicit false", href: "/about", hidden: false },
      ];
      expect(visibleNavLinks(links)).toHaveLength(2);
    });

    it("works with readonly arrays", () => {
      const links: readonly NavLink[] = [
        { label: "Home", href: "/" },
        { label: "Hidden", href: "/hidden", hidden: true },
      ];
      const result = visibleNavLinks(links);
      expect(result).toHaveLength(1);
    });

    it("preserves additional properties on links", () => {
      const links: NavLink[] = [
        { label: "Products", href: "/products", icon: "box", hidden: false },
        { label: "Hidden", href: "/hidden", icon: "gear", hidden: true },
      ];
      const result = visibleNavLinks(links);
      expect(result[0]).toHaveProperty("icon", "box");
    });
  });

  describe("navLabelClass", () => {
    describe("bar variant (default)", () => {
      it("marks the active item with the brand cyan tone", () => {
        const result = navLabelClass(true, "bar");
        expect(result).toContain("text-neon-cyan-bright");
      });

      it("keeps inactive items uniform white with hover", () => {
        const result = navLabelClass(false, "bar");
        expect(result).toContain("text-white/85");
        expect(result).toContain("hover:text-white");
      });

      it("does not apply neon text glows (WEG-uniform labels)", () => {
        expect(navLabelClass(true, "bar")).not.toContain("text-glow");
        expect(navLabelClass(false, "bar")).not.toContain("text-glow");
      });

      it("does not include 'w-full text-left' for bar variant", () => {
        const result = navLabelClass(true, "bar");
        expect(result).not.toContain("w-full");
        expect(result).not.toContain("text-left");
      });

      it("includes base styles for bar variant", () => {
        const result = navLabelClass(true, "bar");
        expect(result).toContain("text-nav");
        expect(result).toContain("whitespace-nowrap");
        expect(result).toContain("uppercase");
        expect(result).toContain("transition-colors");
      });

      it("applies different colors depending on active state, regardless of item position", () => {
        const active = navLabelClass(true, "bar");
        const inactive1 = navLabelClass(false, "bar");
        const inactive2 = navLabelClass(false, "bar");
        expect(active).toContain("neon-cyan-bright");
        expect(inactive1).toContain("text-white/85");
        expect(inactive2).toContain("text-white/85");
      });
    });

    describe("menu variant", () => {
      it("marks the active item with the brand cyan tone in the menu", () => {
        const result = navLabelClass(true, "menu");
        expect(result).toContain("neon-cyan");
      });

      it("keeps inactive menu items uniform white", () => {
        const result = navLabelClass(false, "menu");
        expect(result).toContain("text-white/85");
      });

      it("includes 'w-full text-left' for menu variant", () => {
        const result = navLabelClass(true, "menu");
        expect(result).toContain("w-full");
        expect(result).toContain("text-left");
      });

      it("includes base styles for menu variant", () => {
        const result = navLabelClass(true, "menu");
        expect(result).toContain("text-nav");
        expect(result).toContain("whitespace-nowrap");
        expect(result).toContain("uppercase");
        expect(result).toContain("transition-colors");
      });
    });

    describe("default variant (bar)", () => {
      it("uses bar variant when variant parameter is omitted", () => {
        const withoutVariant = navLabelClass(true);
        const withBarVariant = navLabelClass(true, "bar");
        expect(withoutVariant).toBe(withBarVariant);
      });

      it("produces valid Tailwind class strings", () => {
        const result = navLabelClass(false, "bar");
        // Should be a string with space-separated classes (o `.` cobre
        // valores arbitrários como `tracking-[0.06em]`)
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
        expect(/^[\w\-\s/[\].:]+$/.test(result)).toBe(true);
      });
    });
  });

  describe("isNavLinkActive", () => {
    describe("contact link (real page since 2026-08-24 — behaves like any other link)", () => {
      it("is active on an exact match", () => {
        expect(isNavLinkActive("/pt/contato", "/pt/contato")).toBe(true);
      });

      it("is active on nested routes below it", () => {
        expect(isNavLinkActive("/pt/contato", "/pt/contato/obrigado")).toBe(true);
      });

      it("is NOT active on a different route", () => {
        expect(isNavLinkActive("/pt/contato", "/pt/produtos")).toBe(false);
      });
    });

    describe('home link ("/")', () => {
      it("is active on the bare root", () => {
        expect(isNavLinkActive("/", "/")).toBe(true);
      });

      it("is active on a bare locale root", () => {
        expect(isNavLinkActive("/", "/pt")).toBe(true);
        expect(isNavLinkActive("/", "/en")).toBe(true);
      });

      it("is active on a bare locale root with a trailing slash", () => {
        expect(isNavLinkActive("/", "/pt/")).toBe(true);
      });

      it("is NOT active on nested routes under the locale", () => {
        expect(isNavLinkActive("/", "/pt/produtos")).toBe(false);
        expect(isNavLinkActive("/", "/pt/representantes")).toBe(false);
        expect(isNavLinkActive("/", "/en/catalogo")).toBe(false);
      });
    });

    describe("other locale-prefixed links", () => {
      it("is active on an exact match", () => {
        expect(
          isNavLinkActive("/pt/representantes", "/pt/representantes")
        ).toBe(true);
      });

      it("is NOT active on a different route", () => {
        expect(isNavLinkActive("/pt/representantes", "/pt/produtos")).toBe(
          false
        );
        expect(isNavLinkActive("/pt/representantes", "/pt")).toBe(false);
      });

      it("is active on nested routes below it", () => {
        expect(
          isNavLinkActive("/pt/produtos", "/pt/produtos/alguma-peca")
        ).toBe(true);
      });

      it("does NOT treat a route with a shared prefix as active", () => {
        expect(
          isNavLinkActive("/pt/produtos", "/pt/produtos-outra-coisa")
        ).toBe(false);
      });

      it("is locale-sensitive (different locale is not active)", () => {
        expect(
          isNavLinkActive("/pt/representantes", "/en/representantes")
        ).toBe(false);
      });
    });
  });

  describe("externalProps", () => {
    it("returns target and rel for http URLs", () => {
      const props = externalProps("http://example.com");
      expect(props).toEqual({
        target: "_blank",
        rel: "noopener noreferrer",
      });
    });

    it("returns target and rel for https URLs", () => {
      const props = externalProps("https://example.com");
      expect(props).toEqual({
        target: "_blank",
        rel: "noopener noreferrer",
      });
    });

    it("returns empty object for relative paths", () => {
      expect(externalProps("/about")).toEqual({});
      expect(externalProps("/products/123")).toEqual({});
    });

    it("returns empty object for hash anchors", () => {
      expect(externalProps("#contato")).toEqual({});
      expect(externalProps("#top")).toEqual({});
    });

    it("returns empty object for root path", () => {
      expect(externalProps("/")).toEqual({});
    });

    it("distinguishes http/https from other protocols", () => {
      // Only http/https should trigger external behavior
      expect(externalProps("mailto:test@example.com")).toEqual({});
      expect(externalProps("tel:+5547333352012")).toEqual({});
      expect(externalProps("ftp://files.example.com")).toEqual({});
    });

    it("handles URLs with query strings", () => {
      expect(externalProps("https://example.com?foo=bar")).toEqual({
        target: "_blank",
        rel: "noopener noreferrer",
      });
    });

    it("handles URLs with fragments", () => {
      expect(externalProps("https://example.com#section")).toEqual({
        target: "_blank",
        rel: "noopener noreferrer",
      });
    });

    it("handles relative URLs starting with /", () => {
      expect(externalProps("/relative/path")).toEqual({});
    });

    it("handles relative URLs starting with ./", () => {
      expect(externalProps("./relative/path")).toEqual({});
    });

    it("handles relative URLs starting with ../", () => {
      expect(externalProps("../parent/path")).toEqual({});
    });

    it("case-sensitive protocol matching", () => {
      // HTTP must be lowercase for startsWith check
      expect(externalProps("HTTP://example.com")).toEqual({}); // Uppercase HTTP doesn't match
      expect(externalProps("Http://example.com")).toEqual({}); // Mixed case doesn't match
    });

    it("returns an object with proper structure", () => {
      const props = externalProps("https://example.com");
      if (Object.keys(props).length > 0) {
        expect(Object.keys(props)).toEqual(expect.arrayContaining(["target", "rel"]));
      }
    });
  });
});

describe("nav com origem de lead", () => {
  const DICTIONARY_LINKS: NavLink[] = [
    { label: "Home", href: "/" },
    { label: "Produtos", href: "/produtos" },
    { label: "Portal ROCO", href: "#representantes" },
    { label: "Contato", href: "#contato" },
    { label: "Parked", href: "#contato", hidden: true },
  ];

  describe("siteNavLinks", () => {
    it("resolves the dictionary placeholders to real locale-prefixed routes", () => {
      const links = siteNavLinks(DICTIONARY_LINKS, "pt");
      expect(links.map((link) => link.label)).toEqual([
        "Home",
        "Produtos",
        "Portal ROCO",
        "Contato",
      ]);
      expect(links[2].href).toBe("/pt/representantes");
    });

    it("tags the contact link with the 'menu' origin", () => {
      const links = siteNavLinks(DICTIONARY_LINKS, "pt");
      expect(links[3].href).toBe("/pt/contato?origem=menu");
    });

    it("does not tag links that are not lead-capture pages", () => {
      const links = siteNavLinks(DICTIONARY_LINKS, "pt");
      expect(links[0].href).toBe("/");
      expect(links[1].href).not.toContain("origem=");
      expect(links[2].href).not.toContain("origem=");
    });

    it("still drops hidden items", () => {
      expect(siteNavLinks(DICTIONARY_LINKS, "pt")).toHaveLength(4);
    });

    it("keeps every other property of the item", () => {
      const links = siteNavLinks([{ label: "Contato", href: "#contato", icon: "phone" }], "en");
      expect(links[0]).toEqual({ label: "Contato", href: "/en/contato?origem=menu", icon: "phone" });
    });

    it("applies the locale it was given", () => {
      expect(siteNavLinks(DICTIONARY_LINKS, "en")[3].href).toBe("/en/contato?origem=menu");
    });

    it("does not mutate the input array", () => {
      const original = structuredClone(DICTIONARY_LINKS);
      siteNavLinks(DICTIONARY_LINKS, "pt");
      expect(DICTIONARY_LINKS).toEqual(original);
    });
  });

  describe("isNavLinkActive com querystring no href", () => {
    it("stays active when the href carries an origin (regressão de a11y)", () => {
      expect(isNavLinkActive("/pt/contato?origem=menu", "/pt/contato")).toBe(true);
    });

    it("stays active on a nested route below a tagged href", () => {
      expect(isNavLinkActive("/pt/produtos?origem=menu", "/pt/produtos/valvula")).toBe(true);
    });

    it("stays active when the href carries a fragment", () => {
      expect(isNavLinkActive("/pt/contato#form", "/pt/contato")).toBe(true);
    });

    it("stays active when the href carries both query and fragment", () => {
      expect(isNavLinkActive("/pt/contato?origem=menu#form", "/pt/contato")).toBe(true);
    });

    it("does not turn unrelated routes active", () => {
      expect(isNavLinkActive("/pt/contato?origem=menu", "/pt/produtos")).toBe(false);
      expect(isNavLinkActive("/pt/contato?origem=menu", "/pt/contatos")).toBe(false);
    });

    it("keeps the home rule working when the href is tagged", () => {
      expect(isNavLinkActive("/?origem=menu", "/pt")).toBe(true);
      expect(isNavLinkActive("/?origem=menu", "/pt/contato")).toBe(false);
    });
  });
});
