/**
 * Render SSR do aviso de cadastro em análise (`PendingAccessPanel`) nos dois
 * idiomas e em todos os estados — mesmo critério de `portal-chrome-render.test.tsx`:
 * pega chave de dicionário faltando ("undefined"), placeholder `{x}` sem resolver
 * e exceção na renderização.
 */
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { ThemeProvider } from "@mui/material/styles";
import { describe, expect, it, vi } from "vitest";
import { createPortalTheme } from "@/core/theme";
import type { Locale } from "@/i18n/config";
import en from "@/i18n/dictionaries/en.json";
import pt from "@/i18n/dictionaries/pt.json";
import type { PendingAccessStatus, PortalDictionary } from "@/modules/portal/lib/types";

vi.mock("next/navigation", () => ({
  usePathname: () => "/pt/portal",
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {}, back: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));

import { PendingAccessPanel } from "./pending-access-panel";

const DICTIONARIES: Record<Locale, PortalDictionary> = {
  pt: pt.portal as unknown as PortalDictionary,
  en: en.portal as unknown as PortalDictionary,
};

const STATUSES: PendingAccessStatus[] = ["submitted", "approved", "rejected", "draft", "cnpjConflict", "none"];

/** HTML sem os `<style>` do Emotion (as variáveis CSS do tema trazem um `undefined` legítimo). */
function render(element: ReactElement, locale: Locale): string {
  const html = renderToString(<ThemeProvider theme={createPortalTheme(locale)}>{element}</ThemeProvider>);
  return html.replace(/<style[\s\S]*?<\/style>/g, "");
}

/** Texto como o React o escreve no HTML ("isn't" → "isn&#x27;t"). */
function asHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function panel(locale: Locale, status: PendingAccessStatus, extra: { submittedAt?: string | null; reviewNotes?: string | null } = {}) {
  const copy = DICTIONARIES[locale].pendingAccess;
  return render(
    <PendingAccessPanel
      greeting="Olá, Teste!"
      status={status}
      submittedAt={extra.submittedAt ?? null}
      companyName="Representações Teste Ltda"
      reviewNotes={extra.reviewNotes ?? null}
      copy={copy}
      links={{ onboarding: `/${locale}/portal/onboarding`, contact: `/${locale}/contato`, site: `/${locale}` }}
    />,
    locale
  );
}

describe("PendingAccessPanel", () => {
  for (const locale of ["pt", "en"] as const) {
    for (const status of STATUSES) {
      it(`${locale}/${status}: título do estado, empresa e nenhuma chave faltando`, () => {
        const html = panel(locale, status, { submittedAt: "30 de setembro de 2026" });
        const copy = DICTIONARIES[locale].pendingAccess;
        expect(html).toContain(asHtml(copy[status].title));
        expect(html).toContain("Representações Teste Ltda");
        expect(html).toContain(`href="/${locale}/contato"`);
        expect(html).not.toMatch(/undefined|\[object Object\]|NaN/);
        expect(html).not.toMatch(/\{(date|company)\}/);
      });
    }
  }

  it("em análise: data do envio, etapas e a orientação de esperar", () => {
    const html = panel("pt", "submitted", { submittedAt: "30 de setembro de 2026" });
    expect(html).toContain("Recebemos seu pré-cadastro em 30 de setembro de 2026");
    expect(html).toContain("Análise do time ROCO");
    expect(html).toContain("Você não precisa fazer nada agora");
  });

  it("em análise sem data: cai na mensagem sem o {date}", () => {
    const html = panel("pt", "submitted");
    expect(html).toContain("Recebemos seu pré-cadastro. O time comercial");
  });

  it("reprovado: mostra a observação da análise; rascunho: botão para concluir", () => {
    expect(panel("pt", "rejected", { reviewNotes: "CNPJ inativo na Receita." })).toContain("CNPJ inativo na Receita.");
    const draft = panel("pt", "draft");
    expect(draft).toContain("Concluir cadastro");
    expect(draft).toContain('href="/pt/portal/onboarding"');
  });
});
