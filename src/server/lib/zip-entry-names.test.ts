import { describe, expect, it } from "vitest";
import {
  buildImageZipEntries,
  dedupePaths,
  imageEntryName,
  isSafeZipPath,
  productFolderName,
  sanitizePathSegment,
  type ZipImageRow,
} from "./zip-entry-names";

const row = (overrides: Partial<ZipImageRow>): ZipImageRow => ({
  productId: "p1",
  sku: "1122",
  namePt: "Válvula",
  r2Key: "products/1122/a.png",
  filename: "1122.png",
  contentType: "image/png",
  createdAt: new Date("2026-09-30T12:00:00Z"),
  ...overrides,
});

describe("buildImageZipEntries", () => {
  const rows = [
    row({}),
    row({ r2Key: "products/1122/b.png", filename: "1122.png" }),
    row({ productId: "p2", sku: "2001", namePt: "Joelho 90", r2Key: "products/2001/c.jpg", filename: "foto.jpg", contentType: "image/jpeg" }),
  ];

  it("um produto: arquivos na raiz, numerados na ordem de exibição", () => {
    const entries = buildImageZipEntries(rows.slice(0, 2), { groupByProduct: false });
    expect(entries.map((entry) => entry.path)).toEqual(["01-1122.png", "02-1122.png"]);
    expect(entries[1].r2Key).toBe("products/1122/b.png");
  });

  it("vários produtos: uma pasta por produto, numeração recomeçando", () => {
    const entries = buildImageZipEntries(rows, { groupByProduct: true });
    expect(entries.map((entry) => entry.path)).toEqual([
      "1122 - Válvula/01-1122.png",
      "1122 - Válvula/02-1122.png",
      "2001 - Joelho 90/01-foto.jpg",
    ]);
  });

  it("SKU e nome hostis (vindos do ERP ou do cadastro) não escapam da pasta de extração", () => {
    const hostile = [
      row({ sku: "../..", namePt: ".." }),
      row({ productId: "p2", sku: "../../../..", namePt: "../../../.." }),
      row({ productId: "p3", sku: "/etc", namePt: "/" }),
    ];
    const entries = buildImageZipEntries(hostile, { groupByProduct: true });
    expect(entries.map((entry) => entry.path)).toEqual([
      "produto/01-1122.png",
      "produto/01-1122 (2).png",
      "etc - -/01-1122.png",
    ]);
    expect(entries.every((entry) => isSafeZipPath(entry.path))).toBe(true);
  });
});

describe("isSafeZipPath", () => {
  it("aceita só caminho relativo sem segmento vazio, '.' ou '..'", () => {
    expect(isSafeZipPath("1122 - Válvula/01-1122.png")).toBe(true);
    expect(isSafeZipPath("01-1122.png")).toBe(true);
    for (const unsafe of ["", "/a.png", "../a.png", "a/../b.png", "a/./b.png", "a//b.png", "a\\b.png", "a/b\u0001.png"]) {
      expect(isSafeZipPath(unsafe)).toBe(false);
    }
  });
});

describe("sanitizePathSegment", () => {
  it("troca barra, caracteres proibidos e controle por hífen", () => {
    expect(sanitizePathSegment("a/b\\c:d*e?f|g<h>i\"j", "x")).toBe("a-b-c-d-e-f-g-h-i-j");
    expect(sanitizePathSegment("linha\nquebrada\u0000", "x")).toBe("linha-quebrada-");
  });

  it("não deixa escapar da pasta nem começar com ponto", () => {
    expect(sanitizePathSegment("../../etc/passwd", "x")).toBe("etc-passwd");
    expect(sanitizePathSegment(".oculto", "x")).toBe("oculto");
    expect(sanitizePathSegment("nome. ", "x")).toBe("nome");
  });

  it("preserva acento e usa o fallback quando não sobra nada", () => {
    expect(sanitizePathSegment("Válvula de Descarga", "x")).toBe("Válvula de Descarga");
    expect(sanitizePathSegment("...", "fallback")).toBe("fallback");
    expect(sanitizePathSegment("   ", "fallback")).toBe("fallback");
  });

  it("limita o tamanho sem partir caractere composto", () => {
    const long = "é".repeat(150);
    expect(Array.from(sanitizePathSegment(long, "x"))).toHaveLength(100);
  });

  it("nome enorme custa o mesmo que um curto (sem regex quadrática)", () => {
    const hostile = `Valvula${".".repeat(200_000)}x`;
    const started = performance.now();
    const result = sanitizePathSegment(hostile, "x");
    expect(performance.now() - started).toBeLessThan(250);
    expect(result).toBe("Valvula");
  });

  it("tira controles de direção de texto e marcas invisíveis; C1 vira hífen", () => {
    expect(sanitizePathSegment("foto‮gnp.exe", "x")).toBe("fotognp.exe");
    expect(sanitizePathSegment("a​b⁦c﻿", "x")).toBe("abc");
    expect(sanitizePathSegment("a\u0085b", "x")).toBe("a-b");
  });

  it("nome reservado do Windows ganha sufixo", () => {
    expect(sanitizePathSegment("CON", "x")).toBe("CON-");
    expect(sanitizePathSegment("lpt1.png", "x")).toBe("lpt1.png-");
    expect(sanitizePathSegment("CONSOLE", "x")).toBe("CONSOLE");
  });
});

describe("productFolderName", () => {
  it("SKU + nome do produto", () => {
    expect(productFolderName({ sku: "1122", namePt: 'Engate 1/2" Inox' })).toBe("1122 - Engate 1-2- Inox");
  });

  it("sem nome aproveitável cai no SKU saneado, e depois em 'produto'", () => {
    expect(productFolderName({ sku: "2001", namePt: "..." })).toBe("2001 -");
    expect(productFolderName({ sku: "../..", namePt: ".." })).toBe("produto");
    expect(productFolderName({ sku: "", namePt: "" })).toBe("produto");
  });
});

describe("imageEntryName", () => {
  it("prefixa a posição e mantém o nome original", () => {
    expect(imageEntryName(1, { filename: "1122.png", contentType: "image/png" })).toBe("01-1122.png");
    expect(imageEntryName(12, { filename: "Foto Lateral.JPG", contentType: "image/jpeg" })).toBe(
      "12-Foto Lateral.JPG"
    );
  });

  it("garante a extensão pelo tipo quando o nome não tem", () => {
    expect(imageEntryName(2, { filename: "sem-extensao", contentType: "image/webp" })).toBe(
      "02-sem-extensao.webp"
    );
  });
});

describe("dedupePaths", () => {
  it("numera repetidos antes da extensão, ignorando caixa", () => {
    expect(dedupePaths(["a/01-x.png", "a/01-X.png", "a/01-x.png", "b/01-x.png"])).toEqual([
      "a/01-x.png",
      "a/01-X (2).png",
      "a/01-x (3).png",
      "b/01-x.png",
    ]);
  });

  it("sem extensão, numera no fim", () => {
    expect(dedupePaths(["pasta/arquivo", "pasta/arquivo"])).toEqual(["pasta/arquivo", "pasta/arquivo (2)"]);
  });
});
