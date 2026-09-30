import type {
  ProductDetail,
  ProductFormState,
  ProductPackagingInput,
} from "./product-types";

/** Tetos do contrato (`productMutableFields` em `src/server/trpc/routers/products.ts`). */
export const PRODUCT_FIELD_LIMITS = {
  sku: 20,
  erpCode: 20,
  ncm: 8,
  barcodeEan13: 13,
  featuredOrder: 100_000,
} as const;

/** Estado do formulário a partir do detalhe devolvido por `products.byId`/`update`. */
export function formFromDetail(product: ProductDetail): ProductFormState {
  return {
    sku: product.sku,
    erpCode: product.erpCode ?? "",
    namePt: product.namePt,
    nameEn: product.nameEn ?? "",
    descriptionPt: product.descriptionPt ?? "",
    descriptionEn: product.descriptionEn ?? "",
    ncm: product.ncm ?? "",
    barcodeEan13: product.barcodeEan13 ?? "",
    published: product.published,
    featured: product.featured,
    // A posição só é editável (e enviada) enquanto o produto está em destaque.
    featuredOrder: product.featured ? String(product.featuredOrder) : "",
    bestSeller: product.bestSeller,
    categoryIds: product.categories.map((category) => category.id),
    primaryCategoryId: product.categories.find((category) => category.isPrimary)?.id ?? "",
    badges: product.badges,
    // Só os campos do contrato (o servidor devolve a linha inteira do banco).
    // `erpComplementCode`/`barcodeEan13` da embalagem NÃO são editáveis aqui,
    // mas precisam voltar no salvamento: `replacePackagings` apaga e reinsere
    // todas as embalagens, então descartá-los apagaria o código complementar do
    // ERP e o EAN de cada uma a cada edição do produto.
    packagings: product.packagings.map((packaging) => ({
      id: packaging.id,
      packagingType: packaging.packagingType,
      unitsPerPack: packaging.unitsPerPack,
      isDefault: packaging.isDefault,
      erpComplementCode: packaging.erpComplementCode ?? undefined,
      barcodeEan13: packaging.barcodeEan13 ?? undefined,
    })),
  };
}

/** `""`/inválido -> `undefined` (o servidor põe o produto no fim da fila). */
export function parseFeaturedOrder(value: string): number | undefined {
  const text = value.trim();
  if (text === "") return undefined;
  const parsed = Number(text);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= PRODUCT_FIELD_LIMITS.featuredOrder
    ? parsed
    : undefined;
}

export type ProductFormErrors = {
  sku: boolean;
  namePt: boolean;
  /** Posição da vitrine preenchida mas inválida. */
  featuredOrder: boolean;
  /** Índices das embalagens com quantidade inválida (precisa ser inteiro ≥ 1). */
  packagings: number[];
  /**
   * Índices das embalagens REPETIDAS (mesmo tipo + mesma quantidade de uma
   * anterior). O banco tem unique (produto, tipo, quantidade): sem esta
   * checagem o salvamento falhava inteiro com um erro genérico.
   */
  duplicatePackagings: number[];
};

export function validateProductForm(form: ProductFormState): ProductFormErrors {
  const orderText = form.featuredOrder.trim();
  const seen = new Set<string>();
  const duplicatePackagings: number[] = [];
  form.packagings.forEach((packaging, index) => {
    const key = `${packaging.packagingType}:${packaging.unitsPerPack}`;
    if (seen.has(key)) duplicatePackagings.push(index);
    else seen.add(key);
  });
  return {
    sku: form.sku.trim() === "",
    namePt: form.namePt.trim() === "",
    featuredOrder:
      form.featured && orderText !== "" && parseFeaturedOrder(orderText) === undefined,
    packagings: form.packagings.flatMap((packaging, index) =>
      Number.isInteger(packaging.unitsPerPack) && packaging.unitsPerPack >= 1 ? [] : [index]
    ),
    duplicatePackagings,
  };
}

export function hasProductFormErrors(errors: ProductFormErrors): boolean {
  return (
    errors.sku ||
    errors.namePt ||
    errors.featuredOrder ||
    errors.packagings.length > 0 ||
    errors.duplicatePackagings.length > 0
  );
}

function toPackagingPayload(packaging: ProductPackagingInput) {
  return {
    packagingType: packaging.packagingType,
    unitsPerPack: packaging.unitsPerPack,
    isDefault: packaging.isDefault,
    erpComplementCode: packaging.erpComplementCode || undefined,
    barcodeEan13: packaging.barcodeEan13 || undefined,
  };
}

/**
 * Corpo de `products.create` / `products.update({ patch })`. Texto opcional
 * vazio vira `null` — no `update` isso LIMPA a coluna (`undefined` significaria
 * "não mexer", e o valor apagado no formulário voltaria depois de salvar).
 */
export function buildProductPayload(form: ProductFormState) {
  return {
    sku: form.sku.trim(),
    erpCode: form.erpCode.trim() || null,
    namePt: form.namePt.trim(),
    nameEn: form.nameEn.trim() || null,
    descriptionPt: form.descriptionPt.trim() || null,
    descriptionEn: form.descriptionEn.trim() || null,
    ncm: form.ncm.trim() || null,
    barcodeEan13: form.barcodeEan13.trim() || null,
    published: form.published,
    featured: form.featured,
    featuredOrder: form.featured ? parseFeaturedOrder(form.featuredOrder) : undefined,
    bestSeller: form.bestSeller,
    categoryIds: form.categoryIds,
    primaryCategoryId: form.primaryCategoryId || undefined,
    badges: form.badges,
    packagings: form.packagings.map(toPackagingPayload),
  };
}
