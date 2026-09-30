/**
 * Render SSR do campo de área de atuação: os valores já escolhidos (que chegam
 * prontos do servidor) aparecem como chips antes de a base do IBGE carregar, e a
 * região leva o tipo no chip ("Campinas — SP" é região E cidade).
 */
import { renderToString } from "react-dom/server";
import { ThemeProvider } from "@mui/material/styles";
import { describe, expect, it } from "vitest";
import { createPortalTheme } from "@/core/theme";
import type { Locale } from "@/i18n/config";
import en from "@/i18n/dictionaries/en.json";
import pt from "@/i18n/dictionaries/pt.json";
import type { PortalTerritoryDictionary } from "@/modules/portal/lib/types";
import data from "@/shared/data/ibge-localidades.json";
import { buildTerritoryIndex, resolveTerritoryEntries, type IbgeLocalities } from "@/shared/lib/territory";
import { TerritoryPicker, territoryChipLabel } from "./territory-picker";

const COPY: Record<Locale, PortalTerritoryDictionary> = {
  pt: pt.portal.territory as PortalTerritoryDictionary,
  en: en.portal.territory as PortalTerritoryDictionary,
};

const selected =
  resolveTerritoryEntries(buildTerritoryIndex(data as IbgeLocalities), [
    { kind: "state", code: "PR" },
    { kind: "region", code: "4204" },
    { kind: "city", code: "4202404" },
  ]) ?? [];

function render(locale: Locale, error?: string): string {
  const html = renderToString(
    <ThemeProvider theme={createPortalTheme(locale)}>
      <TerritoryPicker value={selected} onChange={() => {}} copy={COPY[locale]} error={error} />
    </ThemeProvider>
  );
  return html.replace(/<style[\s\S]*?<\/style>/g, "");
}

describe("TerritoryPicker", () => {
  for (const locale of ["pt", "en"] as const) {
    it(`${locale}: chips dos valores, rótulo e ajuda, sem chave faltando`, () => {
      const html = render(locale);
      expect(html).toContain("Paraná");
      expect(html).toContain(`Vale do Itajaí — SC · ${COPY[locale].kinds.region}`);
      expect(html).toContain("Blumenau — SC");
      expect(html).toContain(COPY[locale].label);
      expect(html).toContain(COPY[locale].helper);
      expect(html).not.toMatch(/undefined|\[object Object\]|NaN/);
    });
  }

  it("mostra o erro no lugar da ajuda", () => {
    const html = render("pt", COPY.pt.required);
    expect(html).toContain(COPY.pt.required);
    expect(html).not.toContain(COPY.pt.helper);
  });

  it("chip: só a região leva o tipo", () => {
    expect(selected.map((option) => territoryChipLabel(option, COPY.pt))).toEqual([
      "Paraná",
      "Vale do Itajaí — SC · Região",
      "Blumenau — SC",
    ]);
  });
});
