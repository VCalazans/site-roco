import { describe, expect, it } from "vitest";
import enDictionary from "@/i18n/dictionaries/en.json";
import ptDictionary from "@/i18n/dictionaries/pt.json";

/** Caminhos de todas as folhas (`portal.shell.nav.homeContent`, `...features.0`). */
function leafPaths(value: unknown, prefix = ""): Record<string, unknown> {
  if (value !== null && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>(
      (acc, [key, child]) => Object.assign(acc, leafPaths(child, prefix ? `${prefix}.${key}` : key)),
      {}
    );
  }
  return { [prefix]: value };
}

const pt = leafPaths(ptDictionary.portal, "portal");
const en = leafPaths(enDictionary.portal, "portal");

function placeholders(value: unknown): string {
  return typeof value === "string" ? (value.match(/\{[A-Za-z]+\}/g) ?? []).sort().join(",") : "";
}

describe("dicionário do portal (pt/en)", () => {
  it("tem exatamente as mesmas chaves nos dois idiomas", () => {
    const onlyPt = Object.keys(pt).filter((key) => !(key in en));
    const onlyEn = Object.keys(en).filter((key) => !(key in pt));
    expect({ onlyPt, onlyEn }).toEqual({ onlyPt: [], onlyEn: [] });
  });

  it("não deixa nenhum texto vazio", () => {
    const empty = [...Object.entries(pt), ...Object.entries(en)]
      .filter(([, value]) => value === "")
      .map(([key]) => key);
    expect(empty).toEqual([]);
  });

  it("usa os mesmos placeholders {x} nos dois idiomas", () => {
    const mismatched = Object.keys(pt)
      .filter((key) => key in en && placeholders(pt[key]) !== placeholders(en[key]))
      .map((key) => `${key}: pt=[${placeholders(pt[key])}] en=[${placeholders(en[key])}]`);
    expect(mismatched).toEqual([]);
  });
});
