import { describe, expect, it } from "vitest";
import data from "@/shared/data/ibge-localidades.json";
import {
  buildTerritoryIndex,
  MAX_TERRITORY_ENTRIES,
  normalizeTerritoryText,
  resolveTerritory,
  resolveTerritoryEntries,
  searchTerritories,
  summarizeTerritory,
  type IbgeLocalities,
} from "./territory";

const index = buildTerritoryIndex(data as IbgeLocalities);
const labels = (query: string, limit?: number) => searchTerritories(index, query, limit).map((option) => option.label);

describe("base do IBGE", () => {
  it("tem os 27 estados, as mesorregiões e todos os municípios", () => {
    const base = data as IbgeLocalities;
    expect(base.states).toHaveLength(27);
    expect(base.regions.length).toBeGreaterThan(130);
    expect(base.cities.length).toBeGreaterThan(5500);
  });

  it("resolve por tipo e código IBGE, com rótulo e UF", () => {
    expect(resolveTerritory(index, { kind: "state", code: "SC" })).toMatchObject({ label: "Santa Catarina", uf: "SC" });
    expect(resolveTerritory(index, { kind: "region", code: "4204" })).toMatchObject({ label: "Vale do Itajaí — SC", uf: "SC" });
    expect(resolveTerritory(index, { kind: "city", code: "4202404" })).toMatchObject({ label: "Blumenau — SC", uf: "SC" });
    expect(resolveTerritory(index, { kind: "city", code: "9999999" })).toBeNull();
    expect(resolveTerritory(index, { kind: "region", code: "4202404" })).toBeNull();
  });
});

describe("searchTerritories", () => {
  it("sem texto, os 27 estados", () => {
    expect(searchTerritories(index, "  ", 100)).toHaveLength(27);
  });

  it("ignora acento e caixa; nome que começa com o texto vem primeiro", () => {
    expect(labels("BLUMENAU")[0]).toBe("Blumenau — SC");
    expect(labels("itajai")).toContain("Vale do Itajaí — SC");
    expect(labels("sao jose")).toContain("São José — SC");
  });

  it("estados antes de regiões, regiões antes de cidades; sigla acha o estado", () => {
    expect(labels("santa catarina")[0]).toBe("Santa Catarina");
    expect(labels("sc")[0]).toBe("Santa Catarina");
    const vale = searchTerritories(index, "vale");
    expect(vale[0].kind).toBe("region");
    const firstCity = vale.findIndex((option) => option.kind === "city");
    expect(vale.slice(0, firstCity).every((option) => option.kind === "region")).toBe(true);
  });

  it("uma UF no fim restringe a ela", () => {
    const results = searchTerritories(index, "sao jose sc", 50);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((option) => option.uf === "SC")).toBe(true);
    expect(labels("vale pr").every((label) => label.endsWith("— PR"))).toBe(true);
  });

  it("respeita o limite e não quebra com texto estranho", () => {
    expect(searchTerritories(index, "a", 5)).toHaveLength(5);
    expect(searchTerritories(index, "%%%''")).toHaveLength(27);
    expect(searchTerritories(index, "xyzxyzxyz")).toEqual([]);
  });
});

describe("resolveTerritoryEntries", () => {
  it("resolve, ignora repetidos e ordena (estados, regiões, cidades)", () => {
    const resolved = resolveTerritoryEntries(index, [
      { kind: "city", code: "4202404" },
      { kind: "state", code: "PR" },
      { kind: "region", code: "4204" },
      { kind: "city", code: "4202404" },
    ]);
    expect(resolved?.map((option) => option.label)).toEqual(["Paraná", "Vale do Itajaí — SC", "Blumenau — SC"]);
  });

  it("recusa tipo desconhecido, código inexistente, formato errado e acima do teto", () => {
    expect(resolveTerritoryEntries(index, [{ kind: "country", code: "BR" }])).toBeNull();
    expect(resolveTerritoryEntries(index, [{ kind: "city", code: "123" }])).toBeNull();
    expect(resolveTerritoryEntries(index, [{ kind: "city", code: 4202404 }])).toBeNull();
    expect(resolveTerritoryEntries(index, "SC")).toBeNull();
    const tooMany = (data as IbgeLocalities).cities
      .slice(0, MAX_TERRITORY_ENTRIES + 1)
      .map(([id]) => ({ kind: "city", code: String(id) }));
    expect(resolveTerritoryEntries(index, tooMany)).toBeNull();
  });

  it("lista vazia é válida (quem chama decide se exige ao menos uma)", () => {
    expect(resolveTerritoryEntries(index, [])).toEqual([]);
  });
});

describe("summarizeTerritory / normalizeTerritoryText", () => {
  it("resume na ordem canônica, separado por ·", () => {
    const resolved = resolveTerritoryEntries(index, [
      { kind: "city", code: "4202404" },
      { kind: "state", code: "SC" },
    ]);
    expect(summarizeTerritory(resolved ?? [])).toBe("Santa Catarina · Blumenau — SC");
  });

  it("normaliza acento, caixa e pontuação", () => {
    expect(normalizeTerritoryText("  São José-dos Pinhais! ")).toBe("sao jose dos pinhais");
  });
});
