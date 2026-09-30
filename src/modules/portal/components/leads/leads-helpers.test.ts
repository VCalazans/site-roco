import { describe, expect, it } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import pt from "@/i18n/dictionaries/pt.json";
import type { PortalLeadsDictionary } from "@/modules/portal/lib/leads-dictionary";
import { CONTACT_SUBJECTS } from "@/server/lib/contact-submit";
import { LEAD_ORIGINS } from "@/shared/lib/lead-origin";
import {
  SUBJECT_FILTER_ORDER,
  buildMailtoUrl,
  buildReplyActions,
  buildWhatsappUrl,
  channelErrorMessage,
  describeChannel,
  formatDate,
  formatDateTime,
  formatTime,
  isNotFoundError,
  mailtoHref,
  originLabel,
  pickReplyTemplate,
  replyLocale,
  summarizeLeadItems,
  whatsappNumber,
  type LeadReplyTemplates,
} from "./leads-helpers";

const ptLeads: PortalLeadsDictionary = pt.portal.leads;
const enLeads: PortalLeadsDictionary = en.portal.leads;

describe("SUBJECT_FILTER_ORDER", () => {
  it("cobre exatamente os assuntos do sistema, sem repetir", () => {
    expect([...SUBJECT_FILTER_ORDER].sort()).toEqual([...CONTACT_SUBJECTS].sort());
  });
});

describe("originLabel", () => {
  it("traduz toda origem da lista fechada", () => {
    for (const origin of LEAD_ORIGINS) {
      expect(originLabel(origin, ptLeads.origins)).toBe(ptLeads.origins[origin]);
    }
  });

  it("linhas antigas com a origem 'carrinho' aparecem como lista de orçamento", () => {
    expect(originLabel("carrinho", ptLeads.origins)).toBe(ptLeads.origins.orcamento);
    expect(originLabel("carrinho", enLeads.origins)).toBe(enLeads.origins.orcamento);
  });

  it("sem origem ou origem desconhecida não inventa rótulo", () => {
    expect(originLabel(null, ptLeads.origins)).toBeNull();
    expect(originLabel("", ptLeads.origins)).toBeNull();
    expect(originLabel("qualquer-coisa", ptLeads.origins)).toBeNull();
  });
});

describe("whatsappNumber / buildWhatsappUrl", () => {
  it.each([
    ["(47) 99999-9999", "5547999999999"],
    ["47999999999", "5547999999999"],
    ["(47) 3335-2012", "554733352012"],
    ["+55 47 99999-9999", "5547999999999"],
    ["5547999999999", "5547999999999"],
  ])("normaliza %s", (phone, expected) => {
    expect(whatsappNumber(phone)).toBe(expected);
  });

  it.each(["", "123", "(47) 9999", "+1 415 555 2671 999"])("recusa telefone que não dá para confiar: %s", (phone) => {
    expect(whatsappNumber(phone)).toBeNull();
    expect(buildWhatsappUrl(phone, "oi")).toBeNull();
  });

  it("monta o link wa.me com a mensagem codificada", () => {
    expect(buildWhatsappUrl("(47) 99999-9999")).toBe("https://wa.me/5547999999999");
    expect(buildWhatsappUrl("(47) 99999-9999", "Olá, João & cia")).toBe(
      "https://wa.me/5547999999999?text=Ol%C3%A1%2C%20Jo%C3%A3o%20%26%20cia"
    );
  });
});

describe("buildMailtoUrl", () => {
  it("codifica assunto e corpo, com CRLF nas quebras de linha", () => {
    const url = buildMailtoUrl("joao@empresa.com.br", "ROCO — Lista de orçamento", "Olá, João,\n\nObrigado.");
    expect(url.startsWith("mailto:joao@empresa.com.br?subject=")).toBe(true);
    expect(url).toContain("subject=ROCO%20%E2%80%94%20Lista%20de%20or%C3%A7amento");
    expect(url).toContain("body=Ol%C3%A1%2C%20Jo%C3%A3o%2C%0D%0A%0D%0AObrigado.");
  });

  it("omite o corpo quando não há", () => {
    expect(buildMailtoUrl("a@b.com", "Oi")).toBe("mailto:a@b.com?subject=Oi");
  });

  it("endereço com caracteres de URL não vira cabeçalho extra (ex.: bcc oculto)", () => {
    const url = buildMailtoUrl("a@b.com?bcc=vitima@x.com&cc=y@z.com", "Oi");
    // Só o `?` do início da querystring legítima pode ser literal.
    expect(url.match(/\?/g)).toHaveLength(1);
    expect(url.match(/&/g)).toBeNull();
    expect(url).not.toContain("bcc=");
    expect(url).toContain("%3Fbcc%3D");
    expect(mailtoHref("a+tag@b.com")).toBe("mailto:a%2Btag@b.com");
    expect(mailtoHref("joao@empresa.com.br")).toBe("mailto:joao@empresa.com.br");
  });
});

describe("resposta ao visitante (idioma do visitante, não do painel)", () => {
  const templates: LeadReplyTemplates = { pt: pickReplyTemplate(ptLeads), en: pickReplyTemplate(enLeads) };
  const lead = {
    name: "João Silva",
    email: "joao@empresa.com.br",
    phone: "(47) 99999-9999",
    subject: "cart" as const,
    locale: "pt",
  };

  it("replyLocale: en só para en; qualquer outra coisa cai no português", () => {
    expect(replyLocale("en")).toBe("en");
    expect(replyLocale("pt")).toBe("pt");
    expect(replyLocale("es")).toBe("pt");
    expect(replyLocale("")).toBe("pt");
  });

  it("visitante do site em português: assunto e saudação em português", () => {
    const { mailtoUrl, whatsappUrl } = buildReplyActions(lead, templates);
    const url = new URL(mailtoUrl);
    expect(decodeURIComponent(url.searchParams.get("subject") ?? "")).toBe("ROCO — Lista de orçamento");
    expect(decodeURIComponent(url.searchParams.get("body") ?? "")).toContain("Olá, João Silva,");
    expect(whatsappUrl).toContain("https://wa.me/5547999999999?text=");
    expect(decodeURIComponent(whatsappUrl ?? "")).toContain("Olá, João Silva!");
  });

  it("visitante do site em inglês: a resposta sai em inglês mesmo com o painel em português", () => {
    const { mailtoUrl, whatsappUrl } = buildReplyActions({ ...lead, locale: "en" }, templates);
    const url = new URL(mailtoUrl);
    expect(decodeURIComponent(url.searchParams.get("subject") ?? "")).toBe("ROCO — Quote list");
    expect(decodeURIComponent(url.searchParams.get("body") ?? "")).toContain("Hello João Silva,");
    expect(decodeURIComponent(whatsappUrl ?? "")).toContain("Hello João Silva!");
  });

  it("telefone que não dá para confiar: sem WhatsApp, mas o e-mail continua", () => {
    const { mailtoUrl, whatsappUrl } = buildReplyActions({ ...lead, phone: "123" }, templates);
    expect(whatsappUrl).toBeNull();
    expect(mailtoUrl.startsWith("mailto:joao@empresa.com.br?")).toBe(true);
  });
});

describe("isNotFoundError", () => {
  it("reconhece o NOT_FOUND do tRPC e nada além dele", () => {
    expect(isNotFoundError({ data: { code: "NOT_FOUND" } })).toBe(true);
    expect(isNotFoundError({ data: { code: "FORBIDDEN" } })).toBe(false);
    expect(isNotFoundError(new Error("x"))).toBe(false);
    expect(isNotFoundError({ data: null })).toBe(false);
    expect(isNotFoundError(null)).toBe(false);
    expect(isNotFoundError("NOT_FOUND")).toBe(false);
  });
});

describe("summarizeLeadItems", () => {
  const base = { productName: null, productSku: null, itemsCount: 0, unitsCount: 0 };

  it("lista de orçamento: produtos e unidades, com singular/plural", () => {
    expect(summarizeLeadItems({ ...base, itemsCount: 3, unitsCount: 12 }, ptLeads.items)?.primary).toBe(
      "3 produtos · 12 un."
    );
    expect(summarizeLeadItems({ ...base, itemsCount: 1, unitsCount: 1 }, ptLeads.items)?.primary).toBe(
      "1 produto · 1 un."
    );
    expect(summarizeLeadItems({ ...base, itemsCount: 3, unitsCount: 12 }, enLeads.items)?.primary).toBe(
      "3 products · 12 units"
    );
    expect(summarizeLeadItems({ ...base, itemsCount: 1, unitsCount: 1 }, enLeads.items)?.primary).toBe(
      "1 product · 1 unit"
    );
  });

  it("produto único: nome e SKU", () => {
    expect(
      summarizeLeadItems({ ...base, productName: "Válvula de Descarga", productSku: "1122" }, ptLeads.items)
    ).toEqual({ primary: "Válvula de Descarga", secondary: "SKU 1122" });
    expect(summarizeLeadItems({ ...base, productName: "Válvula" }, ptLeads.items)).toEqual({
      primary: "Válvula",
      secondary: null,
    });
  });

  it("sem produto nenhum: nada a resumir", () => {
    expect(summarizeLeadItems(base, ptLeads.items)).toBeNull();
  });
});

describe("describeChannel", () => {
  it("enviado é sucesso", () => {
    expect(describeChannel("sent")).toEqual({ tone: "success", status: "sent" });
  });

  it("falha real é erro; falta de configuração é aviso", () => {
    expect(describeChannel("failed")).toEqual({ tone: "error", status: "failed" });
    expect(describeChannel("failed", "network")).toEqual({ tone: "error", status: "failed" });
    expect(describeChannel("failed", "not_configured")).toEqual({ tone: "warning", status: "not_configured" });
    expect(describeChannel("failed", "missing_api_key")).toEqual({ tone: "warning", status: "not_configured" });
  });

  it("estados neutros e valor inesperado", () => {
    expect(describeChannel("pending")).toEqual({ tone: "neutral", status: "pending" });
    expect(describeChannel("skipped")).toEqual({ tone: "neutral", status: "skipped" });
    expect(describeChannel("not_configured")).toEqual({ tone: "warning", status: "not_configured" });
    expect(describeChannel("qualquer")).toEqual({ tone: "neutral", status: "unknown" });
  });
});

describe("channelErrorMessage", () => {
  const errors = ptLeads.detail.delivery.errors;

  it("não há mensagem sem erro", () => {
    expect(channelErrorMessage(null, errors)).toBeNull();
    expect(channelErrorMessage("", errors)).toBeNull();
  });

  it("traduz os códigos conhecidos", () => {
    expect(channelErrorMessage("not_configured", errors)).toBe(errors.not_configured);
    expect(channelErrorMessage("rate_limited", errors)).toBe(errors.rate_limited);
    expect(channelErrorMessage("validation_retry_ok", errors)).toBe(errors.validation_retry_ok);
  });

  it("interpreta http_<status> e preserva códigos desconhecidos", () => {
    expect(channelErrorMessage("http_422", errors)).toContain("422");
    expect(channelErrorMessage("http_422", errors)).not.toContain("{code}");
    expect(channelErrorMessage("algo_novo", errors)).toContain("algo_novo");
  });
});

describe("formatação de data", () => {
  // 29/09/2026 14:32 UTC — o dia/hora exibidos dependem do fuso da máquina, então
  // as asserções conferem a FORMA (idioma), não o horário exato.
  const iso = "2026-09-29T14:32:00.000Z";

  it("usa o formato do idioma do painel", () => {
    expect(formatDate(iso, "pt")).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(formatDate(iso, "en")).toMatch(/^\d{1,2}\/\d{1,2}\/\d{2}$/);
    expect(formatTime(iso, "pt")).toMatch(/^\d{2}:\d{2}$/);
    expect(formatDateTime(iso, "pt")).toContain(", ");
  });

  it("aceita Date e devolve travessão para valor inválido", () => {
    expect(formatDate(new Date(iso), "pt")).toBe(formatDate(iso, "pt"));
    expect(formatDate("não-é-data", "pt")).toBe("—");
    expect(formatTime("", "en")).toBe("—");
    expect(formatDateTime("x", "pt")).toBe("—");
  });
});
