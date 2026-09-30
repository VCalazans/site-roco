/**
 * Espelho local do shape de dados esperado do router `products` (contrato
 * tRPC combinado com o backend — ver relatório final). `packagingType`/
 * `badge` usam os mesmos valores do enum Postgres (`src/db/schema/catalog.ts`,
 * não editado por este agente): `peca | blister | caixa | saco_plastico` e
 * `nacional | universal | top | tres_em_um | seguro`.
 */
export type PackagingType = "peca" | "blister" | "caixa" | "saco_plastico";

/**
 * `top` continua no TIPO porque o valor segue existindo no enum do banco (e o
 * importador/tabela ainda sabem rotulá-lo), mas o selo foi migrado para a flag
 * "Campeão de vendas" (spec 001, RF09) e NÃO é mais oferecido no formulário —
 * ver `PRODUCT_BADGES`.
 */
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

/** Selos SELECIONÁVEIS no formulário (sem o legado `top`). */
export const PRODUCT_BADGES: ProductBadge[] = [
  "nacional",
  "universal",
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
  slug: string;
  namePt: string;
  nameEn: string | null;
  published: boolean;
  active: boolean;
  /** Vitrine da home (spec 001). */
  featured: boolean;
  featuredOrder: number;
  /** "Campeão de vendas" — selo de troféu no site. */
  bestSeller: boolean;
  updatedAt: string;
  categories: { id: string; namePt: string }[];
  badges: ProductBadge[];
  imageCount: number;
  /** URL pública da capa (1ª imagem); `null` sem foto ou sem `R2_PUBLIC_URL`. */
  coverUrl: string | null;
  /**
   * TODAS as embalagens, já ordenadas (`sortPackagings`). Não existe embalagem
   * "padrão": o produto pode ser vendido em várias ao mesmo tempo.
   */
  packagings: {
    packagingType: PackagingType;
    unitsPerPack: number;
  }[];
};

/**
 * `products.list` pagina por cursor (`nextCursor`, não `page`/`perPage` como
 * `representatives.list`) mas agora também expõe `total` — a contagem cheia
 * do filtro aplicado, não só da página carregada (usada em "X produtos" na
 * página de listagem, não para paginar).
 */
export type ProductListResult = {
  items: ProductListItem[];
  nextCursor?: string;
  total: number;
};

/** Espelho de `products.stats()` — usado nos cards do dashboard. */
export type ProductStats = {
  total: number;
  published: number;
  active: number;
  unpublished: number;
  featured: number;
  bestSeller: number;
  /** Publicados sem nenhuma imagem: é o que o visitante vê com placeholder. */
  publishedWithoutImage: number;
};

export type ProductPackagingInput = {
  id?: string;
  packagingType: PackagingType;
  unitsPerPack: number;
  /**
   * Coluna legada (o importador a preenche pela aba Sheet1). NÃO é editada nem
   * exibida — não existe embalagem "padrão" —, só devolvida intacta ao salvar.
   */
  isDefault: boolean;
  /** Dados do ERP que o formulário não edita mas precisa devolver ao salvar
   *  (o servidor reinsere todas as embalagens) — ver `formFromDetail`. */
  erpComplementCode?: string | null;
  barcodeEan13?: string | null;
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
  slug: string;
  erpCode: string | null;
  namePt: string;
  nameEn: string | null;
  descriptionPt: string | null;
  descriptionEn: string | null;
  ncm: string | null;
  barcodeEan13: string | null;
  published: boolean;
  active: boolean;
  featured: boolean;
  featuredOrder: number;
  bestSeller: boolean;
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
  featured: boolean;
  /** Texto do campo numérico (vazio = deixar o servidor pôr no fim da fila). */
  featuredOrder: string;
  bestSeller: boolean;
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
  featured: false,
  featuredOrder: "",
  bestSeller: false,
  categoryIds: [],
  primaryCategoryId: "",
  badges: [],
  packagings: [],
};
