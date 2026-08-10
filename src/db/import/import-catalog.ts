/**
 * Importador do catálogo (planilha Excel → Postgres).
 *
 * Roda FORA do bundler do Next.js — por isso importa por caminho relativo
 * (nunca `@/db`, que é `server-only`), mesmo padrão de `src/db/seed.ts`.
 * Cria seu próprio client Drizzle/pg efêmero.
 *
 * Uso:
 *   npm run db:import-catalog
 *   (equivalente a `node --experimental-strip-types src/db/import/import-catalog.ts`)
 *
 * Requer Node 22.6+ (ver observação em `seed.ts`).
 *
 * Fonte: `docs/Dados Catalogo ROCO site_2026.xls`
 *   - Sheet1   — base do catálogo (769 produtos): COD, DESCRICAO, CATEGORIA,
 *     EMBALAG, QUANT CX, COD BARRAS, NCM, colunas de badge (@NACIONAL, ...).
 *   - Planilha1 — variantes de embalagem do ERP (1.254 códigos, ~2.194
 *     linhas): cod_produto, cod_complemento, cod_barras, unid, qtd.
 *   (As abas "Lamina" e "Planilha2" não fazem parte do escopo desta
 *   importação — a primeira é conteúdo de material impresso, a segunda é
 *   uma tabela de equivalência de kits, sem relação com o modelo de produto.)
 *
 * Idempotente: upsert de produtos por `sku` (INSERT define published=false/
 * active=true; UPDATE deliberadamente NÃO toca published/active, para não
 * desfazer curadoria manual do time em reimportações). `product_packagings`,
 * `product_badges` e `product_categories` são delete+insert por produto a
 * cada execução.
 */
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { readFile, utils } from "xlsx";
import {
  categories,
  packagingTypeEnum,
  productBadgeEnum,
  productBadges,
  productCategories,
  productPackagings,
  products,
} from "../schema/catalog";
import { slugify } from "../../server/lib/slugify";

const CATALOG_PATH = fileURLToPath(
  new URL("../../../docs/Dados Catalogo ROCO site_2026.xls", import.meta.url)
);

type PackagingType = (typeof packagingTypeEnum.enumValues)[number];
type BadgeSlug = (typeof productBadgeEnum.enumValues)[number];

const EMBALAG_TO_PACKAGING_TYPE: Record<string, PackagingType> = {
  "saco plástico": "saco_plastico",
  blister: "blister",
  caixa: "caixa",
};

const UNID_TO_PACKAGING_TYPE: Record<string, PackagingType> = {
  pc: "peca",
  bl: "blister",
  cx: "caixa",
};

const BADGE_COLUMNS: { column: string; badge: BadgeSlug }[] = [
  { column: "@NACIONAL", badge: "nacional" },
  { column: "@UNIVERSAL", badge: "universal" },
  { column: "@TOP", badge: "top" },
  { column: "@3EM1", badge: "tres_em_um" },
  { column: "@SEGURO", badge: "seguro" },
];

interface SheetRow {
  COD?: unknown;
  DESCRICAO?: unknown;
  CATEGORIA?: unknown;
  EMBALAG?: unknown;
  "QUANT CX"?: unknown;
  "COD BARRAS"?: unknown;
  NCM?: unknown;
  [badgeColumn: string]: unknown;
}

interface ErpRow {
  cod_produto?: unknown;
  cod_complemento?: unknown;
  cod_barras?: unknown;
  unid?: unknown;
  qtd?: unknown;
}

interface PackagingDraft {
  packagingType: PackagingType;
  unitsPerPack: number;
  erpComplementCode: string | null;
  barcodeEan13: string | null;
  isDefault: boolean;
}

function toTrimmedString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const str = String(value).trim();
  return str.length > 0 ? str : undefined;
}

/** `NCM` — o Excel de origem comeu zeros à esquerda em algumas linhas (7 dígitos em vez de 8). */
function normalizeNcm(raw: unknown): string | undefined {
  const value = toTrimmedString(raw);
  if (!value) return undefined;
  return value.length === 7 ? value.padStart(8, "0") : value;
}

/** Remove zeros à esquerda para casar `Sheet1.COD` com `Planilha1.cod_produto`. */
function normalizeCodeForMatch(code: string): string {
  return code.replace(/^0+/, "") || "0";
}

/** `trim` + colapso de espaços + correção pontual do nome com aspas/acento quebrados. */
function normalizeCategoryName(raw: string): string {
  const collapsed = raw.trim().replace(/\s+/g, " ");
  if (collapsed.toLowerCase() === 'caixa d"água' || collapsed.toLowerCase() === "caixa d'água") {
    return "CAIXA D'ÁGUA";
  }
  return collapsed;
}

interface CatalogProduct {
  sku: string;
  namePt: string;
  categoryName: string;
  ncm?: string;
  barcodeEan13?: string;
  defaultPackaging?: { packagingType: PackagingType; unitsPerPack: number };
  badges: BadgeSlug[];
}

function parseSheetRows(rows: SheetRow[], skipped: string[]): CatalogProduct[] {
  const parsed: CatalogProduct[] = [];

  for (const row of rows) {
    const sku = toTrimmedString(row.COD);
    if (!sku) {
      skipped.push(`linha sem COD: ${JSON.stringify(row).slice(0, 120)}`);
      continue;
    }

    const namePt = toTrimmedString(row.DESCRICAO) ?? "";
    if (namePt.toUpperCase().includes("TOMBAK")) {
      skipped.push(`COD ${sku}: descontinuado (TOMBAK)`);
      continue;
    }

    const categoryRaw = toTrimmedString(row.CATEGORIA);
    if (!categoryRaw) {
      skipped.push(`COD ${sku}: sem CATEGORIA`);
      continue;
    }

    const embalagRaw = toTrimmedString(row.EMBALAG);
    const packagingType = embalagRaw ? EMBALAG_TO_PACKAGING_TYPE[embalagRaw.toLowerCase()] : undefined;
    const quantCxRaw = row["QUANT CX"];
    const unitsPerPack =
      typeof quantCxRaw === "number"
        ? quantCxRaw
        : Number.parseInt(toTrimmedString(quantCxRaw) ?? "", 10);

    const defaultPackaging =
      packagingType && Number.isFinite(unitsPerPack) && unitsPerPack > 0
        ? { packagingType, unitsPerPack }
        : undefined;

    const badges = BADGE_COLUMNS.filter(({ column }) => row[column] !== null && row[column] !== undefined).map(
      ({ badge }) => badge
    );

    parsed.push({
      sku,
      namePt,
      categoryName: normalizeCategoryName(categoryRaw),
      ncm: normalizeNcm(row.NCM),
      barcodeEan13: toTrimmedString(row["COD BARRAS"]),
      defaultPackaging,
      badges,
    });
  }

  return parsed;
}

function groupErpRows(rows: ErpRow[]): Map<string, { erpCode: string; rows: ErpRow[] }> {
  const groups = new Map<string, { erpCode: string; rows: ErpRow[] }>();

  for (const row of rows) {
    const erpCode = toTrimmedString(row.cod_produto);
    if (!erpCode) continue;

    const key = normalizeCodeForMatch(erpCode);
    const group = groups.get(key);
    if (group) {
      group.rows.push(row);
    } else {
      groups.set(key, { erpCode, rows: [row] });
    }
  }

  return groups;
}

function buildPackagings(
  product: CatalogProduct,
  erpGroup: { erpCode: string; rows: ErpRow[] } | undefined,
  skipped: string[]
): { packagings: PackagingDraft[]; erpCode: string | null } {
  const combos = new Map<string, PackagingDraft>();

  if (erpGroup) {
    for (const row of erpGroup.rows) {
      const unid = toTrimmedString(row.unid)?.toLowerCase();
      const packagingType = unid ? UNID_TO_PACKAGING_TYPE[unid] : undefined;
      const qtyRaw = row.qtd;
      const unitsPerPack = typeof qtyRaw === "number" ? qtyRaw : Number.parseInt(toTrimmedString(qtyRaw) ?? "", 10);

      if (!packagingType || !Number.isFinite(unitsPerPack) || unitsPerPack <= 0) {
        skipped.push(`COD ${product.sku}: variante ERP ignorada (unid/qtd inválidos: ${JSON.stringify(row)})`);
        continue;
      }

      const key = `${packagingType}:${unitsPerPack}`;
      if (combos.has(key)) {
        // Unique constraint é (productId, packagingType, unitsPerPack) — mantém a primeira ocorrência.
        continue;
      }

      combos.set(key, {
        packagingType,
        unitsPerPack,
        erpComplementCode: toTrimmedString(row.cod_complemento) ?? null,
        barcodeEan13: toTrimmedString(row.cod_barras) ?? null,
        isDefault: false,
      });
    }
  }

  if (product.defaultPackaging) {
    const key = `${product.defaultPackaging.packagingType}:${product.defaultPackaging.unitsPerPack}`;
    const existing = combos.get(key);
    if (existing) {
      existing.isDefault = true;
    } else {
      combos.set(key, {
        packagingType: product.defaultPackaging.packagingType,
        unitsPerPack: product.defaultPackaging.unitsPerPack,
        erpComplementCode: null,
        barcodeEan13: null,
        isDefault: true,
      });
    }
  }

  return { packagings: [...combos.values()], erpCode: erpGroup?.erpCode ?? null };
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL não configurada.");
  }

  console.log(`[import-catalog] Lendo planilha: ${CATALOG_PATH}`);
  const workbook = readFile(CATALOG_PATH);
  const sheet1 = utils.sheet_to_json<SheetRow>(workbook.Sheets.Sheet1, { defval: null });
  const planilha1 = utils.sheet_to_json<ErpRow>(workbook.Sheets.Planilha1, { defval: null });

  const skipped: string[] = [];
  const catalogProducts = parseSheetRows(sheet1, skipped);
  const erpGroups = groupErpRows(planilha1);

  const categoryNames = [...new Set(catalogProducts.map((product) => product.categoryName))];

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  let productsWritten = 0;
  let packagingsWritten = 0;
  let badgesWritten = 0;

  try {
    console.log(`[import-catalog] Upsert de ${categoryNames.length} categorias...`);
    const categoryIdByName = new Map<string, string>();
    for (const name of categoryNames) {
      const slug = slugify(name);
      const [row] = await db
        .insert(categories)
        .values({ slug, namePt: name })
        .onConflictDoUpdate({ target: categories.slug, set: { namePt: name } })
        .returning({ id: categories.id });
      categoryIdByName.set(name, row.id);
    }

    console.log(`[import-catalog] Importando ${catalogProducts.length} produtos...`);
    for (const product of catalogProducts) {
      const erpGroup = erpGroups.get(normalizeCodeForMatch(product.sku));
      const { packagings, erpCode } = buildPackagings(product, erpGroup, skipped);
      const categoryId = categoryIdByName.get(product.categoryName);
      if (!categoryId) {
        skipped.push(`COD ${product.sku}: categoria "${product.categoryName}" não resolvida`);
        continue;
      }

      const slug = slugify(product.namePt) || product.sku;

      const [productRow] = await db
        .insert(products)
        .values({
          sku: product.sku,
          erpCode,
          slug,
          namePt: product.namePt,
          ncm: product.ncm ?? null,
          barcodeEan13: product.barcodeEan13 ?? null,
          published: false,
          active: true,
        })
        .onConflictDoUpdate({
          target: products.sku,
          // Deliberadamente sem `published`/`active`: reimportar não deve
          // desfazer curadoria manual (produto publicado/despublicado à mão).
          set: {
            erpCode,
            slug,
            namePt: product.namePt,
            ncm: product.ncm ?? null,
            barcodeEan13: product.barcodeEan13 ?? null,
            updatedAt: new Date(),
          },
        })
        .returning({ id: products.id });

      await db.delete(productCategories).where(eq(productCategories.productId, productRow.id));
      await db.insert(productCategories).values({ productId: productRow.id, categoryId, isPrimary: true });

      await db.delete(productBadges).where(eq(productBadges.productId, productRow.id));
      if (product.badges.length > 0) {
        await db
          .insert(productBadges)
          .values(product.badges.map((badge) => ({ productId: productRow.id, badge })));
        badgesWritten += product.badges.length;
      }

      await db.delete(productPackagings).where(eq(productPackagings.productId, productRow.id));
      if (packagings.length > 0) {
        await db.insert(productPackagings).values(
          packagings.map((packaging) => ({
            productId: productRow.id,
            ...packaging,
          }))
        );
        packagingsWritten += packagings.length;
      }

      productsWritten++;
    }

    // Códigos do ERP que não existem na Sheet1 ficam de fora desta importação
    // por design (spec: só entram variantes de produtos que já estão na base).
    const unmatchedErpGroups = [...erpGroups.keys()].filter(
      (key) => !catalogProducts.some((product) => normalizeCodeForMatch(product.sku) === key)
    );

    console.log("[import-catalog] Concluído:", {
      products: productsWritten,
      categories: categoryIdByName.size,
      packagings: packagingsWritten,
      badges: badgesWritten,
      skipped: skipped.length,
      erpOnlyGroupsIgnored: unmatchedErpGroups.length,
    });
    if (skipped.length > 0) {
      console.log("[import-catalog] Itens ignorados:", skipped);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("[import-catalog] Falhou:", error);
  process.exitCode = 1;
});
