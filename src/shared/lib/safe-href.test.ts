import { describe, it, expect } from "vitest";
import { isSafeHref, MAX_HREF_LENGTH } from "./safe-href";

describe("isSafeHref", () => {
  describe("internal paths", () => {
    it("accepts absolute internal paths", () => {
      expect(isSafeHref("/produtos")).toBe(true);
      expect(isSafeHref("/contato")).toBe(true);
      expect(isSafeHref("/catalogo")).toBe(true);
    });

    it("accepts paths with querystring", () => {
      expect(isSafeHref("/pt/contato?assunto=quote")).toBe(true);
      expect(isSafeHref("/produtos?category=gas")).toBe(true);
      expect(isSafeHref("/catalogo?param=value&other=x")).toBe(true);
    });

    it("accepts paths with locale prefix", () => {
      expect(isSafeHref("/pt/contato")).toBe(true);
      expect(isSafeHref("/en/produtos")).toBe(true);
      expect(isSafeHref("/pt/catalogo?x=1")).toBe(true);
    });

    it("rejects protocol-relative paths", () => {
      expect(isSafeHref("//evil.com")).toBe(false);
      expect(isSafeHref("//roco.com.br")).toBe(false);
    });

    it("rejects backslash tricks", () => {
      expect(isSafeHref("/\\evil.com")).toBe(false);
    });
  });

  describe("anchors", () => {
    it("accepts simple anchors", () => {
      expect(isSafeHref("#produtos")).toBe(true);
      expect(isSafeHref("#catalogo")).toBe(true);
      expect(isSafeHref("#sobre")).toBe(true);
    });

    it("rejects bare hash", () => {
      expect(isSafeHref("#")).toBe(false);
    });
  });

  describe("http/https URLs", () => {
    it("accepts valid https URLs", () => {
      expect(isSafeHref("https://roco.com.br")).toBe(true);
      expect(isSafeHref("https://roco.com.br/x")).toBe(true);
    });

    it("accepts valid http URLs", () => {
      expect(isSafeHref("http://example.com")).toBe(true);
      expect(isSafeHref("http://localhost:3000")).toBe(true);
    });

    it("rejects https:// with no hostname", () => {
      expect(isSafeHref("https://")).toBe(false);
    });

    it("rejects http:// with no hostname", () => {
      expect(isSafeHref("http://")).toBe(false);
    });
  });

  describe("mailto and tel", () => {
    it("accepts mailto links", () => {
      expect(isSafeHref("mailto:a@b.com")).toBe(true);
      expect(isSafeHref("mailto:contact@roco.com.br")).toBe(true);
    });

    it("rejects mailto: with no email", () => {
      expect(isSafeHref("mailto:")).toBe(false);
    });

    it("accepts tel links", () => {
      expect(isSafeHref("tel:+5547")).toBe(true);
      expect(isSafeHref("tel:+554733352012")).toBe(true);
    });

    it("rejects tel: with no number", () => {
      expect(isSafeHref("tel:")).toBe(false);
    });
  });

  describe("javascript: injection", () => {
    it("rejects javascript: protocol", () => {
      expect(isSafeHref("javascript:alert(1)")).toBe(false);
      expect(isSafeHref("javascript:document.cookie")).toBe(false);
    });

    it("rejects uppercase JAVASCRIPT:", () => {
      expect(isSafeHref("JAVASCRIPT:alert(1)")).toBe(false);
      expect(isSafeHref("JavaScript:alert(1)")).toBe(false);
    });
  });

  describe("data: injection", () => {
    it("rejects data: protocol", () => {
      expect(isSafeHref("data:text/html,<script>")).toBe(false);
      expect(isSafeHref("data:text/html,alert(1)")).toBe(false);
    });

    it("rejects data: with uppercase", () => {
      expect(isSafeHref("DATA:text/html,")).toBe(false);
    });
  });

  describe("other dangerous protocols", () => {
    it("rejects vbscript:", () => {
      expect(isSafeHref("vbscript:msgbox(1)")).toBe(false);
    });

    it("rejects file:", () => {
      expect(isSafeHref("file:///etc/passwd")).toBe(false);
    });
  });

  describe("whitespace handling", () => {
    it("trims leading/trailing whitespace", () => {
      expect(isSafeHref("  /produtos  ")).toBe(true);
      expect(isSafeHref("\n/contato\n")).toBe(true);
      expect(isSafeHref("\t#catalogo\t")).toBe(true);
    });

    it("rejects paths with internal whitespace", () => {
      expect(isSafeHref("/pro dutos")).toBe(false);
      expect(isSafeHref("/con\ttato")).toBe(false);
      expect(isSafeHref("/con\ntato")).toBe(false);
    });

    it("rejects control characters", () => {
      expect(isSafeHref("/con\u0000tato")).toBe(false);
      expect(isSafeHref("/con\u007Ftato")).toBe(false);
    });
  });

  describe("length limits", () => {
    it("accepts href exactly at MAX_HREF_LENGTH", () => {
      const longPath = "/" + "x".repeat(MAX_HREF_LENGTH - 1);
      expect(isSafeHref(longPath)).toBe(true);
    });

    it("rejects href over MAX_HREF_LENGTH", () => {
      const tooLong = "/" + "x".repeat(MAX_HREF_LENGTH);
      expect(isSafeHref(tooLong)).toBe(false);
    });

    it("rejects empty string", () => {
      expect(isSafeHref("")).toBe(false);
    });

    it("rejects whitespace-only string", () => {
      expect(isSafeHref("   ")).toBe(false);
    });
  });

  describe("non-string inputs", () => {
    it("rejects null", () => {
      expect(isSafeHref(null)).toBe(false);
    });

    it("rejects undefined", () => {
      expect(isSafeHref(undefined)).toBe(false);
    });

    it("rejects numbers", () => {
      expect(isSafeHref(123)).toBe(false);
    });

    it("rejects booleans", () => {
      expect(isSafeHref(true)).toBe(false);
      expect(isSafeHref(false)).toBe(false);
    });

    it("rejects objects", () => {
      expect(isSafeHref({})).toBe(false);
    });

    it("rejects arrays", () => {
      expect(isSafeHref(["/produtos"])).toBe(false);
    });
  });

  describe("real-world examples", () => {
    it("accepts typical product listing URLs", () => {
      expect(isSafeHref("/pt/produtos?category=gas&sort=price")).toBe(true);
    });

    it("accepts typical contact form URLs", () => {
      expect(isSafeHref("/pt/contato?assunto=quote&product=abc-123")).toBe(true);
    });

    it("accepts hero CTA URLs", () => {
      expect(isSafeHref("#produtos")).toBe(true);
      expect(isSafeHref("#catalogo")).toBe(true);
    });

    it("rejects XSS attempts", () => {
      expect(isSafeHref('javascript:fetch("http://evil.com")')).toBe(false);
      expect(isSafeHref("//evil.com/steal-cookies")).toBe(false);
    });
  });
});
