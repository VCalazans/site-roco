import "server-only";
import { eq, inArray } from "drizzle-orm";
import type { db as dbClient } from "@/db";
import { representatives, representativeTerritories } from "@/db/schema";
import data from "@/shared/data/ibge-localidades.json";
import {
  buildTerritoryIndex,
  resolveTerritory,
  sortTerritory,
  summarizeTerritory,
  type IbgeLocalities,
  type TerritoryIndex,
  type TerritoryOption,
} from "@/shared/lib/territory";

type Database = typeof dbClient;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

let cachedIndex: TerritoryIndex | null = null;

/** Índice da base do IBGE (montado uma vez por processo). */
export function getTerritoryIndex(): TerritoryIndex {
  cachedIndex ??= buildTerritoryIndex(data as IbgeLocalities);
  return cachedIndex;
}

/**
 * Troca as áreas de atuação do representante e grava o resumo legível em
 * `representatives.region` (listas, telas antigas). Lista vazia apaga tudo.
 */
export async function replaceRepresentativeTerritory(
  tx: Transaction,
  representativeId: string,
  options: TerritoryOption[]
): Promise<void> {
  await tx.delete(representativeTerritories).where(eq(representativeTerritories.representativeId, representativeId));
  if (options.length > 0) {
    await tx.insert(representativeTerritories).values(
      options.map((option) => ({ representativeId, kind: option.kind, code: option.code, uf: option.uf }))
    );
  }
  await tx
    .update(representatives)
    .set({ region: summarizeTerritory(options) || null, updatedAt: new Date() })
    .where(eq(representatives.id, representativeId));
}

/**
 * Áreas de vários representantes, já com rótulo e na ordem canônica. Código
 * que não existe mais na base (município extinto numa atualização) some da
 * tela sem quebrar nada — o resumo em `region` continua mostrando o nome antigo.
 */
export async function loadRepresentativeTerritories(
  db: Database,
  representativeIds: string[]
): Promise<Map<string, TerritoryOption[]>> {
  const byRepresentative = new Map<string, TerritoryOption[]>();
  if (representativeIds.length === 0) return byRepresentative;

  const rows = await db
    .select({
      representativeId: representativeTerritories.representativeId,
      kind: representativeTerritories.kind,
      code: representativeTerritories.code,
    })
    .from(representativeTerritories)
    .where(inArray(representativeTerritories.representativeId, representativeIds));

  const index = getTerritoryIndex();
  for (const row of rows) {
    const option = resolveTerritory(index, { kind: row.kind, code: row.code });
    if (!option) continue;
    const list = byRepresentative.get(row.representativeId) ?? [];
    list.push(option);
    byRepresentative.set(row.representativeId, list);
  }
  for (const [representativeId, list] of byRepresentative) {
    byRepresentative.set(representativeId, sortTerritory(list));
  }
  return byRepresentative;
}
