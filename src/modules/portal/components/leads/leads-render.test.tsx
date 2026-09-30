/**
 * Teste de renderização (SSR, sem navegador) da caixa de Solicitações: não há
 * jsdom/testing-library no projeto, então `renderToString` é o que pega o que
 * o `tsc` não pega — chave de dicionário faltando virando "undefined" na tela,
 * placeholder `{x}` sem resolver, exceção na renderização e vazamento da
 * palavra proibida ("carrinho"). Interação (clique, digitação) continua sendo
 * validada no navegador.
 */
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { inferRouterOutputs } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { createPortalTheme } from "@/core/theme";
import { TRPCProvider } from "@/core/trpc-client";
import en from "@/i18n/dictionaries/en.json";
import pt from "@/i18n/dictionaries/pt.json";
import type { Locale } from "@/i18n/config";
import type { AppRouter } from "@/server/trpc/routers/_app";
import { LeadDetailBody } from "./lead-detail-dialog";
import { LeadsPageClient } from "./leads-page-client";
import { LeadsTable, type LeadListItem } from "./leads-table";
import { pickReplyTemplate } from "./leads-helpers";

type LeadDetail = inferRouterOutputs<AppRouter>["leads"]["byId"];

const DICTIONARIES = { pt: pt.portal.leads, en: en.portal.leads } as const;
const replyTemplates = { pt: pickReplyTemplate(pt.portal.leads), en: pickReplyTemplate(en.portal.leads) };

function render(node: ReactElement, locale: Locale = "pt"): string {
  const queryClient = new QueryClient();
  const trpcClient = createTRPCClient<AppRouter>({
    links: [httpBatchLink({ url: "http://localhost/api/trpc" })],
  });
  return renderToString(
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        <ThemeProvider theme={createPortalTheme(locale)}>{node}</ThemeProvider>
      </TRPCProvider>
    </QueryClientProvider>
  );
}

/** Sinais de que um texto não foi resolvido: valor ausente, objeto impresso ou `{placeholder}` intacto. */
function expectNoBrokenText(html: string) {
  // O Emotion injeta <style> no HTML do SSR; o CSS não é texto de tela e pode conter qualquer coisa.
  const markup = html.replace(/<style[\s\S]*?<\/style>/g, "");
  expect(markup).not.toMatch(/undefined|\[object Object\]|NaN/);
  expect(markup).not.toMatch(/\{[a-zA-Z]+\}/);
  expect(markup).not.toMatch(/carrinho/i);
}

const baseItem: LeadListItem = {
  id: "11111111-1111-4111-8111-111111111111",
  createdAt: "2026-09-29T14:32:00.000Z",
  subject: "cart",
  name: "João Silva",
  companyName: "Empresa Ltda",
  productName: null,
  productSku: null,
  origin: "orcamento",
  locale: "pt",
  rdStationStatus: "sent",
  emailStatus: "failed",
  itemsCount: 3,
  unitsCount: 12,
};

const sampleRows: LeadListItem[] = [
  baseItem,
  {
    ...baseItem,
    id: "22222222-2222-4222-8222-222222222222",
    subject: "quote",
    name: "Maria Souza",
    productName: "Válvula de Descarga",
    productSku: "1122",
    itemsCount: 0,
    unitsCount: 0,
    origin: "home-fachada",
  },
  { ...baseItem, id: "33333333-3333-4333-8333-333333333333", subject: "call_back", itemsCount: 0, unitsCount: 0, origin: null },
  { ...baseItem, id: "44444444-4444-4444-8444-444444444444", subject: "general", itemsCount: 0, unitsCount: 0, companyName: null },
  // Linha antiga, gravada antes de a origem "carrinho" virar "orcamento".
  { ...baseItem, id: "55555555-5555-4555-8555-555555555555", subject: "catalog", itemsCount: 0, unitsCount: 0, origin: "carrinho" },
];

describe.each(["pt", "en"] as const)("caixa de Solicitações (%s)", (locale) => {
  const dictionary = DICTIONARIES[locale];

  it("página: cabeçalho, abas por assunto e busca (estado de carregamento)", () => {
    const html = render(
      <LeadsPageClient locale={locale} dictionary={dictionary} replyTemplates={replyTemplates} />,
      locale
    );
    expect(html).toContain(dictionary.title);
    expect(html).toContain(dictionary.subtitle);
    expect(html).toContain(dictionary.filters.all);
    for (const subject of ["cart", "quote", "call_back", "general", "catalog"] as const) {
      expect(html).toContain(dictionary.subjects[subject]);
    }
    expect(html).toContain(`placeholder="${dictionary.search.placeholder}"`);
    expectNoBrokenText(html);
  });

  it("tabela: uma linha por solicitação, com assunto, itens, origem e canais", () => {
    const html = render(
      <LeadsTable locale={locale} dictionary={dictionary} items={sampleRows} isLoading={false} onOpen={() => {}} />,
      locale
    );
    for (const subject of ["cart", "quote", "call_back", "general", "catalog"] as const) {
      expect(html).toContain(dictionary.subjects[subject]);
    }
    // Lista de orçamento resume produtos e unidades; orçamento de produto mostra nome + SKU.
    expect(html).toContain(locale === "pt" ? "3 produtos · 12 un." : "3 products · 12 units");
    expect(html).toContain("Válvula de Descarga");
    expect(html).toContain("SKU 1122");
    expect(html).toContain(dictionary.origins["home-fachada"]);
    // A origem legada "carrinho" aparece como lista de orçamento, sem vazar a palavra antiga.
    expect(html).toContain(dictionary.origins.orcamento);
    // Canais: tooltip vira aria-label do chip.
    expect(html).toContain(`aria-label="${dictionary.channels.rdStation}: ${dictionary.channels.status.sent}"`);
    expect(html).toContain(`aria-label="${dictionary.channels.email}: ${dictionary.channels.status.failed}"`);
    // Um botão de detalhes por linha, com o nome no rótulo acessível.
    expect(html).toContain(dictionary.table.viewDetails.replace("{name}", "João Silva"));
    expectNoBrokenText(html);
  });

  it("tabela: estado de carregamento não mostra dados", () => {
    const html = render(
      <LeadsTable locale={locale} dictionary={dictionary} items={[]} isLoading onOpen={() => {}} />,
      locale
    );
    expect(html).toContain("MuiSkeleton");
    expect(html).not.toContain("João Silva");
    expectNoBrokenText(html);
  });
});

const cartDetail: LeadDetail = {
  ...baseItem,
  // e-mail/telefone só existem no DETALHE (a lista não os devolve — LGPD).
  email: "joao@empresa.com.br",
  phone: "(47) 99999-9999",
  cnpj: "11.222.333/0001-81",
  message: "Preciso de 12 unidades.\nEntrega em Blumenau.",
  productSlug: null,
  utmSource: "google",
  utmMedium: "cpc",
  utmCampaign: "verao",
  consentGranted: true,
  consentAt: "2026-09-29T14:32:00.000Z",
  rdStationError: null,
  emailError: "not_configured",
  items: [
    { productSlug: "valvula-de-descarga", productName: "Válvula de Descarga", productSku: "1122", quantity: 10 },
    { productSlug: null, productName: "Produto removido", productSku: "9999", quantity: 2 },
  ],
} as LeadDetail;

describe.each(["pt", "en"] as const)("detalhe da solicitação (%s)", (locale) => {
  const dictionary = DICTIONARIES[locale];
  const whatsappUrl = "https://wa.me/5547999999999?text=Oi";

  it("mostra contato, campanha, mensagem, itens e o resultado de cada canal", () => {
    const html = render(
      <LeadDetailBody lead={cartDetail} locale={locale} dictionary={dictionary} whatsappUrl={whatsappUrl} />,
      locale
    );
    // Contato
    expect(html).toContain('href="mailto:joao@empresa.com.br"');
    expect(html).toContain('href="tel:47999999999"');
    expect(html).toContain(`href="${whatsappUrl}"`);
    expect(html).toContain("11.222.333/0001-81");
    // Solicitação
    expect(html).toContain(dictionary.origins.orcamento);
    expect(html).toContain(locale === "pt" ? "origem: google · mídia: cpc · campanha: verao" : "source: google · medium: cpc · campaign: verao");
    // Mensagem preservada com quebra de linha (pre-wrap)
    expect(html).toContain("Preciso de 12 unidades.");
    expect(html).toContain("white-space:pre-wrap");
    // Itens: link só para item com slug; o sem slug não gera link
    expect(html).toContain('href="/' + locale + '/produtos/valvula-de-descarga"');
    expect(html).toContain("Produto removido");
    expect(html).toContain(locale === "pt" ? "2 produtos · 12 un." : "2 products · 12 units");
    // Canais: RD enviado sem motivo; e-mail "não configurado" mostra a explicação
    expect(html).toContain(dictionary.detail.delivery.errors.not_configured);
    expect(html).not.toContain(dictionary.detail.delivery.errors.network);
    expectNoBrokenText(html);
  });

  it("nunca expõe IP nem user-agent (a API não devolve)", () => {
    const html = render(
      <LeadDetailBody lead={cartDetail} locale={locale} dictionary={dictionary} whatsappUrl={null} />,
      locale
    );
    expect(html).not.toMatch(/user.?agent|\bip\b/i);
  });

  it("solicitação sem itens, mensagem, campanha e consentimento: usa os textos de vazio", () => {
    const bare = {
      ...cartDetail,
      subject: "general",
      items: [],
      message: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      consentGranted: false,
      consentAt: null,
      companyName: null,
      cnpj: null,
      origin: null,
      emailError: null,
      emailStatus: "sent",
    } as LeadDetail;
    const html = render(
      <LeadDetailBody lead={bare} locale={locale} dictionary={dictionary} whatsappUrl={null} />,
      locale
    );
    expect(html).toContain(dictionary.detail.noMessage);
    expect(html).toContain(dictionary.detail.consentMissing);
    expect(html).not.toContain(dictionary.detail.sections.products);
    expectNoBrokenText(html);
  });

  it("orçamento de produto único mostra o produto de interesse com SKU", () => {
    const single = {
      ...cartDetail,
      subject: "quote",
      items: [],
      productName: "Válvula de Descarga",
      productSku: "1122",
      productSlug: "valvula-de-descarga",
    } as LeadDetail;
    const html = render(
      <LeadDetailBody lead={single} locale={locale} dictionary={dictionary} whatsappUrl={null} />,
      locale
    );
    expect(html).toContain(dictionary.detail.singleProduct);
    expect(html).toContain("Válvula de Descarga");
    expect(html).toContain("SKU 1122");
    expect(html).toContain('href="/' + locale + '/produtos/valvula-de-descarga"');
    expectNoBrokenText(html);
  });

  it("falha do RD Station mostra o motivo traduzido", () => {
    const failed = { ...cartDetail, rdStationStatus: "failed", rdStationError: "http_422" } as LeadDetail;
    const html = render(
      <LeadDetailBody lead={failed} locale={locale} dictionary={dictionary} whatsappUrl={null} />,
      locale
    );
    expect(html).toContain("422");
    expect(html).toContain(dictionary.detail.delivery.reason.split("{error}")[0]);
    expectNoBrokenText(html);
  });
});
