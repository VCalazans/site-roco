import { z } from "zod";
import { MAX_TERRITORY_ENTRIES, TERRITORY_KINDS } from "./territory";

/**
 * Formato de cada área de atuação como chega dos formulários (`{ kind, code }`).
 * Só o formato: a existência do código na base do IBGE é conferida no servidor
 * por `resolveTerritoryEntries`.
 */
export const territoryEntrySchema = z.object({
  kind: z.enum(TERRITORY_KINDS),
  code: z.string().trim().min(1).max(8),
});

export const territoryInputSchema = z.array(territoryEntrySchema).max(MAX_TERRITORY_ENTRIES);
