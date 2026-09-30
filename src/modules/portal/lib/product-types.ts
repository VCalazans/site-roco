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
  /** Todas as imagens do produto (as do site e as só do portal). */
  imageCount: number;
  /** Imagens marcadas para aparecer no site; 0 = o site mostra o espaço reservado. */
  siteImageCount: number;
  /**
   * Miniatura: a capa do site (1ª imagem visível); sem imagem visível, a 1ª do
   * portal. `null` sem foto ou sem `R2_PUBLIC_URL`.
   */
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
 * Página de `products.list` (paginação numerada, como `representatives.list`).
 * `total` é a contagem cheia do filtro; `page` é a página EFETIVA — o servidor
 * limita a pedida ao intervalo real, e o cliente adota esta.
 */
export type ProductListResult = {
  items: ProductListItem[];
  total: number;
  page: number;
  perPage: number;
};

/** Espelho de `products.imagesSummary` — tamanho de um download em lote. */
export type ProductImagesSummary = {
  /** Produtos do filtro que têm ao menos uma imagem. */
  productCount: number;
  imageCount: number;
  totalBytes: number;
};

/** Espelho de `products.stats()` — usado nos cards do dashboard. */
export type ProductStats = {
  total: number;
  published: number;
  active: number;
  unpublished: number;
  featured: number;
  bestSeller: number;
  /** Publicados sem nenhuma imagem NO SITE: é o que o visitante vê com o espaço reservado. */
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

/** Imagem no cadastro do produto (`products.byId`), na ordem de exibição. */
export type ProductImage = {
  id: string;
  url: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  altPt: string | null;
  /** Aparece no site? Desmarcada, fica só no portal (download dos representantes). */
  showOnSite: boolean;
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
