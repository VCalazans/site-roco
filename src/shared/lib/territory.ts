/**
 * Área de atuação do representante: estados inteiros, regiões (mesorregiões do
 * IBGE, ex.: "Vale do Itajaí") e cidades, a partir da base
 * `src/shared/data/ibge-localidades.json` (gerada por
 * `scripts/build-ibge-localidades.mjs`).
 *
 * Módulo puro: a base entra por parâmetro. O navegador a carrega só quando o
 * campo aparece (import dinâmico — são ~200 KB) e o servidor a importa direto
 * para validar o que chega e montar os rótulos.
 */

export const TERRITORY_KINDS = ["state", "region", "city"] as const;
export type TerritoryKind = (typeof TERRITORY_KINDS)[number];

/** O que fica gravado: o tipo e o código IBGE (sigla da UF, id da mesorregião ou do município). */
export type TerritoryEntry = { kind: TerritoryKind; code: string };

/** Entrada resolvida na base: rótulo pronto e a UF (é por ela que o admin filtra). */
export type TerritoryOption = TerritoryEntry & {
  /** "Santa Catarina", "Vale do Itajaí — SC", "Blumenau — SC". */
  label: string;
  /** Nome sem a UF ("Blumenau"). */
  name: string;
  uf: string;
};

/** Formato do JSON da base (tuplas, para caber leve no navegador). */
export type IbgeLocalities = {
  source: string;
  retrievedAt: string;
  states: [string, string][];
  regions: [number, string, string][];
  cities: [number, string, string][];
};

/** Teto de áreas por representante — sobra para quem atende dezenas de cidades. */
export const MAX_TERRITORY_ENTRIES = 60;

/** Quantas sugestões a busca devolve por vez. */
export const TERRITORY_SEARCH_LIMIT = 30;

const KIND_ORDER: Record<TerritoryKind, number> = { state: 0, region: 1, city: 2 };

/** Sem acento, minúsculas, espaços e pontuação simplificados — para comparar texto digitado. */
export function normalizeTerritoryText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function territoryKey(entry: TerritoryEntry): string {
  return `${entry.kind}:${entry.code}`;
}

type IndexedOption = { option: TerritoryOption; text: string; words: string[] };

export type TerritoryIndex = {
  byKey: Map<string, TerritoryOption>;
  states: TerritoryOption[];
  indexed: IndexedOption[];
  ufs: Set<string>;
};

/** Índice para busca e resolução — montado uma vez por base. */
export function buildTerritoryIndex(data: IbgeLocalities): TerritoryIndex {
  const stateNames = new Map(data.states.map(([uf, name]) => [uf, name]));
  const options: TerritoryOption[] = [
    ...data.states.map(([uf, name]) => ({ kind: "state" as const, code: uf, name, uf, label: name })),
    ...data.regions.map(([id, name, uf]) => ({
      kind: "region" as const,
      code: String(id),
      name,
      uf,
      label: `${name} — ${uf}`,
    })),
    ...data.cities.map(([id, name, uf]) => ({
      kind: "city" as const,
      code: String(id),
      name,
      uf,
      label: `${name} — ${uf}`,
    })),
  ];
  const indexed = options.map((option) => {
    const text = normalizeTerritoryText(option.name);
    return { option, text, words: text.split(" ") };
  });
  return {
    byKey: new Map(options.map((option) => [territoryKey(option), option])),
    states: options.filter((option) => option.kind === "state"),
    indexed,
    ufs: new Set(stateNames.keys()),
  };
}

/** Entrada da base pelo tipo e código, ou `null` se não existe. */
export function resolveTerritory(index: TerritoryIndex, entry: TerritoryEntry): TerritoryOption | null {
  return index.byKey.get(territoryKey(entry)) ?? null;
}

/**
 * Busca sem acento: nome que começa com o texto primeiro, depois palavra do
 * nome que começa com ele, depois "contém"; estados antes de regiões, regiões
 * antes de cidades, e cada grupo em ordem alfabética. A sigla acha o estado
 * ("sc"), e uma UF no fim restringe a ela ("blumenau sc", "vale pr"). Sem texto,
 * a lista dos 27 estados.
 */
export function searchTerritories(
  index: TerritoryIndex,
  query: string,
  limit: number = TERRITORY_SEARCH_LIMIT
): TerritoryOption[] {
  const normalized = normalizeTerritoryText(query);
  if (!normalized) return index.states.slice(0, limit);

  let tokens = normalized.split(" ");
  let ufFilter: string | null = null;
  const last = tokens[tokens.length - 1].toUpperCase();
  if (tokens.length > 1 && last.length === 2 && index.ufs.has(last)) {
    ufFilter = last;
    tokens = tokens.slice(0, -1);
  }
  const text = tokens.join(" ");

  const scored: { option: TerritoryOption; score: number }[] = [];
  for (const entry of index.indexed) {
    if (ufFilter && entry.option.uf !== ufFilter) continue;
    let score: number;
    if (entry.text === text || (entry.option.kind === "state" && entry.option.uf.toLowerCase() === text)) score = 0;
    else if (entry.text.startsWith(text)) score = 1;
    else if (entry.words.some((word) => word.startsWith(text))) score = 2;
    else if (entry.text.includes(text)) score = 3;
    else continue;
    scored.push({ option: entry.option, score });
  }

  scored.sort(
    (a, b) =>
      a.score - b.score ||
      KIND_ORDER[a.option.kind] - KIND_ORDER[b.option.kind] ||
      a.option.name.localeCompare(b.option.name, "pt-BR") ||
      a.option.uf.localeCompare(b.option.uf)
  );
  return scored.slice(0, limit).map((item) => item.option);
}

/** Ordem canônica: estados, regiões e cidades, cada grupo em ordem alfabética. */
export function sortTerritory(options: TerritoryOption[]): TerritoryOption[] {
  return [...options].sort(
    (a, b) =>
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      a.name.localeCompare(b.name, "pt-BR") ||
      a.uf.localeCompare(b.uf)
  );
}

/**
 * Valida o que veio do formulário: lista de `{ kind, code }` com tipos válidos,
 * códigos que existem na base, sem repetidos (os repetidos são ignorados) e até
 * `MAX_TERRITORY_ENTRIES`. Devolve as entradas resolvidas e ordenadas, ou `null`
 * se algo não existe ou passou do teto.
 */
export function resolveTerritoryEntries(index: TerritoryIndex, entries: unknown): TerritoryOption[] | null {
  if (!Array.isArray(entries)) return null;
  const resolved = new Map<string, TerritoryOption>();
  for (const entry of entries) {
    if (typeof entry !== "object" || entry === null) return null;
    const { kind, code } = entry as { kind?: unknown; code?: unknown };
    if (typeof kind !== "string" || !(TERRITORY_KINDS as readonly string[]).includes(kind)) return null;
    if (typeof code !== "string") return null;
    const option = resolveTerritory(index, { kind: kind as TerritoryKind, code });
    if (!option) return null;
    resolved.set(territoryKey(option), option);
  }
  if (resolved.size > MAX_TERRITORY_ENTRIES) return null;
  return sortTerritory([...resolved.values()]);
}

/**
 * Resumo legível para `representatives.region` — a coluna de texto que as
 * listas e telas antigas já mostram ("Santa Catarina · Vale do Itajaí — PR ·
 * Curitiba — PR").
 */
export function summarizeTerritory(options: TerritoryOption[]): string {
  return sortTerritory(options)
    .map((option) => option.label)
    .join(" · ");
}
