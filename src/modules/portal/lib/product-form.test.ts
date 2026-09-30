import { describe, expect, it } from "vitest";
import {
  buildProductPayload,
  formFromDetail,
  hasProductFormErrors,
  parseFeaturedOrder,
  validateProductForm,
} from "./product-form";
import {
  EMPTY_PRODUCT_FORM,
  PRODUCT_BADGES,
  type ProductDetail,
  type ProductFormState,
} from "./product-types";

function detail(overrides: Partial<ProductDetail> = {}): ProductDetail {
  return {
    id: "p1",
    sku: "1001",
    slug: "joelho-90",
    erpCode: null,
    namePt: "Joelho 90",
    nameEn: null,
    descriptionPt: null,
    descriptionEn: null,
    ncm: null,
    barcodeEan13: null,
    published: true,
    active: true,
    featured: false,
    featuredOrder: 0,
    bestSeller: false,
    categories: [],
    badges: [],
    packagings: [],
    images: [],
    ...overrides,
  };
}

function form(overrides: Partial<ProductFormState> = {}): ProductFormState {
  return { ...EMPTY_PRODUCT_FORM, sku: "1001", namePt: "Joelho 90", ...overrides };
}

describe("PRODUCT_BADGES", () => {
  it("não oferece mais o selo legado 'top' (virou 'campeão de vendas')", () => {
    expect(PRODUCT_BADGES).not.toContain("top");
    expect(PRODUCT_BADGES).toEqual(["nacional", "universal", "tres_em_um", "seguro"]);
  });
});

describe("formFromDetail", () => {
  it("troca null por texto vazio e resolve a categoria principal", () => {
    const result = formFromDetail(
      detail({
        categories: [
          { id: "c1", isPrimary: false },
          { id: "c2", isPrimary: true },
        ],
      })
    );
    expect(result.erpCode).toBe("");
    expect(result.nameEn).toBe("");
    expect(result.categoryIds).toEqual(["c1", "c2"]);
    expect(result.primaryCategoryId).toBe("c2");
  });

  it("só carrega a posição da vitrine quando o produto está em destaque", () => {
    expect(formFromDetail(detail({ featured: false, featuredOrder: 7 })).featuredOrder).toBe("");
    expect(formFromDetail(detail({ featured: true, featuredOrder: 7 })).featuredOrder).toBe("7");
  });

  it("preserva o código complementar e o EAN das embalagens, tirando o resto da linha do banco", () => {
    const result = formFromDetail(
      detail({
        packagings: [
          {
            id: "k1",
            packagingType: "caixa",
            unitsPerPack: 12,
            isDefault: true,
            erpComplementCode: "0002",
            barcodeEan13: "7891234567895",
            // campos extras da linha do banco não devem vazar para o formulário
            ...({ productId: "p1", createdAt: "2026-01-01" } as object),
          },
        ],
      })
    );
    expect(result.packagings).toEqual([
      {
        id: "k1",
        packagingType: "caixa",
        unitsPerPack: 12,
        isDefault: true,
        erpComplementCode: "0002",
        barcodeEan13: "7891234567895",
      },
    ]);
  });
});

describe("parseFeaturedOrder", () => {
  it("aceita inteiros de 0 ao teto e devolve undefined no resto", () => {
    expect(parseFeaturedOrder("0")).toBe(0);
    expect(parseFeaturedOrder(" 12 ")).toBe(12);
    expect(parseFeaturedOrder("")).toBeUndefined();
    expect(parseFeaturedOrder("-1")).toBeUndefined();
    expect(parseFeaturedOrder("1.5")).toBeUndefined();
    expect(parseFeaturedOrder("abc")).toBeUndefined();
    expect(parseFeaturedOrder("100001")).toBeUndefined();
  });
});

describe("validateProductForm", () => {
  it("exige SKU e nome em português", () => {
    const errors = validateProductForm(EMPTY_PRODUCT_FORM);
    expect(errors.sku).toBe(true);
    expect(errors.namePt).toBe(true);
    expect(hasProductFormErrors(errors)).toBe(true);
  });

  it("trata espaços como vazio", () => {
    const errors = validateProductForm(form({ sku: "   ", namePt: "  " }));
    expect(errors.sku).toBe(true);
    expect(errors.namePt).toBe(true);
  });

  it("um formulário mínimo é válido", () => {
    expect(hasProductFormErrors(validateProductForm(form()))).toBe(false);
  });

  it("só valida a posição da vitrine com o destaque ligado", () => {
    expect(validateProductForm(form({ featured: false, featuredOrder: "abc" })).featuredOrder).toBe(false);
    expect(validateProductForm(form({ featured: true, featuredOrder: "abc" })).featuredOrder).toBe(true);
    expect(validateProductForm(form({ featured: true, featuredOrder: "" })).featuredOrder).toBe(false);
    expect(validateProductForm(form({ featured: true, featuredOrder: "3" })).featuredOrder).toBe(false);
  });

  it("aponta as embalagens com quantidade inválida", () => {
    const errors = validateProductForm(
      form({
        packagings: [
          { packagingType: "peca", unitsPerPack: 1, isDefault: true },
          { packagingType: "caixa", unitsPerPack: 0, isDefault: false },
          { packagingType: "blister", unitsPerPack: 2.5, isDefault: false },
        ],
      })
    );
    expect(errors.packagings).toEqual([1, 2]);
  });

  it("aponta a embalagem REPETIDA (mesmo tipo e quantidade) sem marcar a primeira", () => {
    const errors = validateProductForm(
      form({
        packagings: [
          { packagingType: "blister", unitsPerPack: 12, isDefault: false },
          { packagingType: "blister", unitsPerPack: 1, isDefault: false },
          { packagingType: "blister", unitsPerPack: 12, isDefault: false },
          { packagingType: "caixa", unitsPerPack: 12, isDefault: false },
        ],
      })
    );
    expect(errors.duplicatePackagings).toEqual([2]);
    expect(hasProductFormErrors(errors)).toBe(true);
  });

  it("várias embalagens diferentes do mesmo produto são válidas (não existe 'padrão')", () => {
    const errors = validateProductForm(
      form({
        packagings: [
          { packagingType: "peca", unitsPerPack: 1, isDefault: false },
          { packagingType: "blister", unitsPerPack: 1, isDefault: false },
          { packagingType: "blister", unitsPerPack: 12, isDefault: false },
        ],
      })
    );
    expect(errors.duplicatePackagings).toEqual([]);
    expect(hasProductFormErrors(errors)).toBe(false);
  });
});

describe("buildProductPayload", () => {
  it("apara os textos e transforma opcional vazio em null (limpa no update)", () => {
    const payload = buildProductPayload(
      form({
        sku: " 1001 ",
        namePt: " Joelho 90 ",
        nameEn: "  ",
        erpCode: "",
        descriptionPt: "",
        descriptionEn: " ",
        barcodeEan13: "",
        ncm: " 39174090 ",
      })
    );
    expect(payload.sku).toBe("1001");
    expect(payload.namePt).toBe("Joelho 90");
    expect(payload.nameEn).toBeNull();
    expect(payload.erpCode).toBeNull();
    expect(payload.descriptionPt).toBeNull();
    expect(payload.descriptionEn).toBeNull();
    expect(payload.barcodeEan13).toBeNull();
    expect(payload.ncm).toBe("39174090");
  });

  it("envia as flags da vitrine; a posição só vai com o destaque ligado", () => {
    const off = buildProductPayload(form({ featured: false, featuredOrder: "5", bestSeller: true }));
    expect(off.featured).toBe(false);
    expect(off.featuredOrder).toBeUndefined();
    expect(off.bestSeller).toBe(true);

    const on = buildProductPayload(form({ featured: true, featuredOrder: "5" }));
    expect(on.featured).toBe(true);
    expect(on.featuredOrder).toBe(5);

    const onWithoutOrder = buildProductPayload(form({ featured: true, featuredOrder: "" }));
    expect(onWithoutOrder.featuredOrder).toBeUndefined();
  });

  it("devolve à embalagem só os campos do contrato, mantendo os dados do ERP", () => {
    const payload = buildProductPayload(
      form({
        packagings: [
          {
            id: "k1",
            packagingType: "caixa",
            unitsPerPack: 12,
            isDefault: true,
            erpComplementCode: "0002",
            barcodeEan13: null,
          },
        ],
      })
    );
    expect(payload.packagings).toEqual([
      {
        packagingType: "caixa",
        unitsPerPack: 12,
        isDefault: true,
        erpComplementCode: "0002",
        barcodeEan13: undefined,
      },
    ]);
    // `id` da linha do banco não faz parte do contrato de entrada.
    expect(payload.packagings[0]).not.toHaveProperty("id");
  });

  it("categoria principal vazia vira undefined", () => {
    expect(buildProductPayload(form({ primaryCategoryId: "" })).primaryCategoryId).toBeUndefined();
    expect(buildProductPayload(form({ primaryCategoryId: "c1" })).primaryCategoryId).toBe("c1");
  });
});
