import { interpolate } from "@/shared/lib/interpolate";

/**
 * Embalagens de um produto (revisão da spec 001, 2026-09-30).
 *
 * Regra do negócio: a embalagem pode ser COMPOSTA — o mesmo produto é vendido
 * em várias embalagens ao mesmo tempo (peça avulsa, blister, blister com 12…)
 * e NENHUMA é a "padrão". Por isso: toda embalagem cadastrada aparece, sempre
 * na mesma ordem, sem destaque para uma delas. A coluna legada `is_default`
 * (preenchida pelo importador a partir da aba Sheet1) não é exibida em lugar
 * nenhum.
 *
 * Módulo puro (sem I/O): usado pelo site (detalhe do produto) e pelo portal
 * (tabela de produtos). O texto vem do dicionário de quem chama.
 */

/** Ordem de exibição dos tipos — do menor volume de venda para o maior. */
export const PACKAGING_TYPE_ORDER = ["peca", "blister", "saco_plastico", "caixa"] as const;

export type PackagingLike = {
  packagingType: string;
  unitsPerPack: number;
};

function typeRank(type: string): number {
  const index = (PACKAGING_TYPE_ORDER as readonly string[]).indexOf(type);
  return index === -1 ? PACKAGING_TYPE_ORDER.length : index;
}

/** Ordena por tipo (`PACKAGING_TYPE_ORDER`) e, dentro do tipo, pela quantidade. Não muta a entrada. */
export function sortPackagings<T extends PackagingLike>(packagings: readonly T[]): T[] {
  return [...packagings].sort(
    (a, b) =>
      typeRank(a.packagingType) - typeRank(b.packagingType) ||
      a.unitsPerPack - b.unitsPerPack ||
      a.packagingType.localeCompare(b.packagingType)
  );
}

/** Textos da descrição (chave `products.packagingInfo` dos dicionários). */
export type PackagingCopy = {
  types: Record<string, string>;
  /** Peça × 1: título e texto próprios ("Peça avulsa" / "Vendida por unidade"). */
  singlePieceTitle: string;
  singlePiece: string;
  /** `{count}` = unidades na embalagem. */
  unitsOne: string;
  unitsOther: string;
};

/**
 * Descrição legível de UMA embalagem: título (o tipo) + quantidade por
 * embalagem. Tipo desconhecido (valor novo no enum antes do dicionário) não
 * quebra: vira o próprio slug, sem `_`.
 */
export function describePackaging(packaging: PackagingLike, copy: PackagingCopy): { title: string; detail: string } {
  const units = packaging.unitsPerPack;
  if (packaging.packagingType === "peca" && units === 1) {
    return { title: copy.singlePieceTitle, detail: copy.singlePiece };
  }
  const title = copy.types[packaging.packagingType] ?? packaging.packagingType.replace(/_/g, " ");
  const detail = interpolate(units === 1 ? copy.unitsOne : copy.unitsOther, { count: units });
  return { title, detail };
}
