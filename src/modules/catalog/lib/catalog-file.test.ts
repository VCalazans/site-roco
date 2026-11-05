import { describe, expect, it } from "vitest";
import { isCatalogFileKey, parseCatalogFile } from "./catalog-file";

const KEY = "site/catalogo/3f2b8c1e-7a54-4d21-9c0e-1b2a3c4d5e6f.pdf";
const FILE = { key: KEY, filename: "Catálogo 2027.pdf", sizeBytes: 1024, updatedAt: "2026-11-05T12:00:00.000Z" };

describe("isCatalogFileKey", () => {
  it("aceita só a chave gerada pelo presign", () => {
    expect(isCatalogFileKey(KEY)).toBe(true);
  });

  it.each([
    "site/catalogo/catalogo.pdf",
    "products/123/3f2b8c1e-7a54-4d21-9c0e-1b2a3c4d5e6f.pdf",
    "site/catalogo/../materials/3f2b8c1e-7a54-4d21-9c0e-1b2a3c4d5e6f.pdf",
    "site/catalogo/3f2b8c1e-7a54-4d21-9c0e-1b2a3c4d5e6f.exe",
    "",
  ])("recusa %s", (key) => {
    expect(isCatalogFileKey(key)).toBe(false);
  });
});

describe("parseCatalogFile", () => {
  it("lê o documento salvo", () => {
    expect(parseCatalogFile(JSON.stringify(FILE))).toEqual(FILE);
  });

  it.each([null, undefined, "", "não é json", "{}", JSON.stringify({ ...FILE, key: "materials/x.pdf" })])(
    "conta %s como sem arquivo",
    (raw) => {
      expect(parseCatalogFile(raw)).toBeNull();
    }
  );
});
