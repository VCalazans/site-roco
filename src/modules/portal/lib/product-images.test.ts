import { describe, expect, it } from "vitest";
import { EMPTY_PRODUCT_FILTERS } from "./product-filters";
import {
  IMAGES_ZIP_MAX_BYTES,
  IMAGES_ZIP_MAX_FILES,
  countSiteImages,
  exceedsZipLimits,
  filteredImagesZipHref,
  moveToFront,
  productImageDownloadHref,
  productImagesZipHref,
  siteCoverId,
} from "./product-images";

describe("links de download", () => {
  it("imagem avulsa e ZIP de um produto", () => {
    expect(productImageDownloadHref("abc")).toBe("/api/portal/products/images/abc/download");
    expect(productImagesZipHref("abc")).toBe("/api/portal/products/images/zip?product=abc");
  });

  it("ZIP do filtro usa os mesmos parâmetros da tabela; sem filtro, o catálogo inteiro", () => {
    expect(filteredImagesZipHref(EMPTY_PRODUCT_FILTERS)).toBe("/api/portal/products/images/zip");
    expect(
      filteredImagesZipHref({ ...EMPTY_PRODUCT_FILTERS, search: "engate", quick: ["bestSeller"] })
    ).toBe("/api/portal/products/images/zip?search=engate&filter=bestSeller");
  });
});

describe("exceedsZipLimits", () => {
  it("barra por quantidade de arquivos ou por tamanho", () => {
    expect(exceedsZipLimits({ imageCount: 600, totalBytes: 340 * 1024 * 1024 })).toBe(false);
    expect(exceedsZipLimits({ imageCount: IMAGES_ZIP_MAX_FILES + 1, totalBytes: 1 })).toBe(true);
    expect(exceedsZipLimits({ imageCount: 1, totalBytes: IMAGES_ZIP_MAX_BYTES + 1 })).toBe(true);
  });
});

describe("siteCoverId", () => {
  it("é a primeira imagem visível no site, na ordem de exibição", () => {
    expect(
      siteCoverId([
        { id: "a", showOnSite: false },
        { id: "b", showOnSite: true },
        { id: "c", showOnSite: true },
      ])
    ).toBe("b");
  });

  it("sem imagem visível, não há capa (o site mostra o espaço reservado)", () => {
    expect(siteCoverId([{ id: "a", showOnSite: false }])).toBeNull();
    expect(siteCoverId([])).toBeNull();
  });
});

describe("countSiteImages", () => {
  it("conta só as visíveis", () => {
    expect(countSiteImages([{ showOnSite: true }, { showOnSite: false }, { showOnSite: true }])).toBe(2);
  });
});

describe("moveToFront", () => {
  it("leva o id escolhido para a frente mantendo a ordem das demais", () => {
    expect(moveToFront(["a", "b", "c", "d"], "c")).toEqual(["c", "a", "b", "d"]);
  });

  it("já na frente ou desconhecido: mesma ordem, sem alterar o array recebido", () => {
    const ids = ["a", "b"];
    expect(moveToFront(ids, "a")).toEqual(["a", "b"]);
    expect(moveToFront(ids, "x")).toEqual(["a", "b"]);
    expect(ids).toEqual(["a", "b"]);
  });
});
