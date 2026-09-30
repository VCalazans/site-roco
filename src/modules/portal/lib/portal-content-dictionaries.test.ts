import { describe, expect, it } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import pt from "@/i18n/dictionaries/pt.json";
import { CONTACT_SUBJECTS } from "@/server/lib/contact-submit";
import { LEAD_ORIGINS } from "@/shared/lib/lead-origin";
import type { PortalHomeContentDictionary } from "./home-content-dictionary";
import type { PortalLeadsDictionary } from "./leads-dictionary";

/**
 * Atribuições ao tipo declarado: se um JSON ganhar/perder chave ou mudar de
 * formato em relação a `PortalHomeContentDictionary`/`PortalLeadsDictionary`,
 * `tsc` (e `next build`, que checa arquivos de teste) quebra AQUI — os
 * accessors `getPortal*Dictionary` fazem só um cast e não pegariam isso.
 */
const ptHomeContent: PortalHomeContentDictionary = pt.portal.homeContent;
const enHomeContent: PortalHomeContentDictionary = en.portal.homeContent;
const ptLeads: PortalLeadsDictionary = pt.portal.leads;
const enLeads: PortalLeadsDictionary = en.portal.leads;

const NAMESPACES = [
  ["portal.homeContent", ptHomeContent, enHomeContent],
  ["portal.leads", ptLeads, enLeads],
] as const;

type Leaf = { path: string; value: string };

function leaves(node: unknown, path = ""): Leaf[] {
  if (typeof node === "string") return [{ path, value: node }];
  if (node && typeof node === "object") {
    return Object.entries(node).flatMap(([key, child]) => leaves(child, path ? `${path}.${key}` : key));
  }
  return [];
}

const placeholders = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

describe.each(NAMESPACES)("%s", (_name, ptNode, enNode) => {
  const ptLeaves = leaves(ptNode);
  const enLeaves = leaves(enNode);

  it("tem as mesmas chaves em pt e en", () => {
    expect(enLeaves.map((leaf) => leaf.path).sort()).toEqual(ptLeaves.map((leaf) => leaf.path).sort());
  });

  it("não tem texto vazio", () => {
    expect([...ptLeaves, ...enLeaves].filter((leaf) => leaf.value.trim() === "")).toEqual([]);
  });

  it("usa os mesmos {placeholders} nos dois idiomas", () => {
    const enByPath = new Map(enLeaves.map((leaf) => [leaf.path, leaf.value]));
    for (const leaf of ptLeaves) {
      expect({ path: leaf.path, placeholders: placeholders(enByPath.get(leaf.path) ?? "") }).toEqual({
        path: leaf.path,
        placeholders: placeholders(leaf.value),
      });
    }
  });

  it("nunca diz 'carrinho' (a lista de orçamento tem outro nome na interface)", () => {
    expect([...ptLeaves, ...enLeaves].filter((leaf) => /carrinho|shopping cart/i.test(leaf.value))).toEqual([]);
  });
});

describe("portal.leads", () => {
  it.each([
    ["pt", ptLeads],
    ["en", enLeads],
  ] as const)("(%s) dá rótulo a todo assunto e a toda origem do sistema", (_locale, leads) => {
    expect(Object.keys(leads.subjects).sort()).toEqual([...CONTACT_SUBJECTS].sort());
    expect(Object.keys(leads.origins).sort()).toEqual([...LEAD_ORIGINS].sort());
  });

  it("a lista de orçamento e o orçamento de produto têm nomes distintos", () => {
    expect(ptLeads.subjects.cart).not.toBe(ptLeads.subjects.quote);
    expect(enLeads.subjects.cart).not.toBe(enLeads.subjects.quote);
  });
});
