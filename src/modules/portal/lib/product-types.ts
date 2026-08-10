/**
 * Espelho local do shape de dados esperado do router `products` (contrato
 * tRPC combinado com o backend — ver relatório final). `packagingType`/
 * `badge` usam os mesmos valores do enum Postgres (`src/db/schema/catalog.ts`,
 * não editado por este agente): `peca | blister | caixa | saco_plastico` e
 * `nacional | universal | top | tres_em_um | seguro`.
 */
export type PackagingType = "peca" | "blister" | "caixa" | "saco_plastico";

export type ProductBadge =
  | "nacional"
  | "universal"
  | "top"
  | "tres_em_um"
  | "seguro";

export const PACKAGING_TYPES: PackagingType[] = [
  "peca",
  "blister",
  "caixa",
  "saco_plastico",
];

export const PRODUCT_BADGES: ProductBadge[] = [
  "nacional",
  "universal",
  "top",
  "tres_em_um",
  "seguro",
];

export type ProductCategoryOption = {
  id: string;
  namePt: string;
  nameEn: string | null;
};

export type ProductListItem = {
  id: string;
  sku: string;
  namePt: string;
  nameEn: string | null;
  published: boolean;
  active: boolean;
  updatedAt: string;
  categories: { id: string; namePt: string }[];
  badges: ProductBadge[];
  imageCount: number;
  defaultPackaging: {
    packagingType: PackagingType;
    unitsPerPack: number;
  } | null;
};

export type ProductPackagingInput = {
  id?: string;
  packagingType: PackagingType;
  unitsPerPack: number;
  isDefault: boolean;
};

export type ProductImage = {
  id: string;
  url: string;
  filename: string;
  altPt: string | null;
};

export type ProductDetail = {
  id: string;
  sku: string;
  erpCode: string | null;
  namePt: string;
  nameEn: string | null;
  descriptionPt: string | null;
  descriptionEn: string | null;
  ncm: string | null;
  barcodeEan13: string | null;
  published: boolean;
  active: boolean;
  categories: { id: string; isPrimary: boolean }[];
  badges: ProductBadge[];
  packagings: ProductPackagingInput[];
  images: ProductImage[];
};

export type ProductFormState = {
  sku: string;
  erpCode: string;
  namePt: string;
  nameEn: string;
  descriptionPt: string;
  descriptionEn: string;
  ncm: string;
  barcodeEan13: string;
  published: boolean;
  categoryIds: string[];
  primaryCategoryId: string;
  badges: ProductBadge[];
  packagings: ProductPackagingInput[];
};

export const EMPTY_PRODUCT_FORM: ProductFormState = {
  sku: "",
  erpCode: "",
  namePt: "",
  nameEn: "",
  descriptionPt: "",
  descriptionEn: "",
  ncm: "",
  barcodeEan13: "",
  published: false,
  categoryIds: [],
  primaryCategoryId: "",
  badges: [],
  packagings: [],
};
