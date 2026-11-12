import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildFbc,
  fbclidFromFbc,
  META_LEAD_EVENTS,
  normalizeFbclid,
  readLeadEventId,
  sanitizeFbCookie,
  trackMeta,
  trackMetaLead,
} from "./meta-pixel";

describe("META_LEAD_EVENTS", () => {
  it("orçamento, catálogo e lista são Lead; ligamos e fale conosco são Contact", () => {
    expect(META_LEAD_EVENTS.quote.eventName).toBe("Lead");
    expect(META_LEAD_EVENTS.catalog.eventName).toBe("Lead");
    expect(META_LEAD_EVENTS.cart.eventName).toBe("Lead");
    expect(META_LEAD_EVENTS.call_back.eventName).toBe("Contact");
    expect(META_LEAD_EVENTS.general.eventName).toBe("Contact");
    expect(META_LEAD_EVENTS.catalog.contentName).toBe("catalogo-roco");
  });
});

describe("fbclid e _fbc", () => {
  it("aceita fbclid válido e recusa valor estranho", () => {
    expect(normalizeFbclid(" IwAR1abc-_9 ")).toBe("IwAR1abc-_9");
    expect(normalizeFbclid("a b")).toBeUndefined();
    expect(normalizeFbclid("<script>")).toBeUndefined();
    expect(normalizeFbclid("")).toBeUndefined();
    expect(normalizeFbclid(null)).toBeUndefined();
  });

  it("monta _fbc no formato da Meta e lê o fbclid de volta", () => {
    const fbc = buildFbc("IwAR1abc", 1700000000000);
    expect(fbc).toBe("fb.1.1700000000000.IwAR1abc");
    expect(fbclidFromFbc(fbc)).toBe("IwAR1abc");
    expect(fbclidFromFbc("lixo")).toBeUndefined();
    expect(fbclidFromFbc(undefined)).toBeUndefined();
  });

  it("sanitizeFbCookie só deixa passar o formato fb.N.timestamp.valor", () => {
    expect(sanitizeFbCookie("fb.1.1700000000000.IwAR1abc")).toBe("fb.1.1700000000000.IwAR1abc");
    expect(sanitizeFbCookie("fb.1.1700000000.123456789")).toBe("fb.1.1700000000.123456789");
    expect(sanitizeFbCookie("fb.1.x.y")).toBeUndefined();
    expect(sanitizeFbCookie("qualquer")).toBeUndefined();
    expect(sanitizeFbCookie(undefined)).toBeUndefined();
  });
});

describe("trackMeta", () => {
  // Ambiente de teste é Node: um `window` mínimo basta.
  beforeEach(() => {
    vi.stubGlobal("window", {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("não faz nada sem o Pixel carregado", () => {
    expect(() => trackMeta("PageView")).not.toThrow();
  });

  it("chama fbq com eventID quando há id", () => {
    const fbq = vi.fn();
    (window as unknown as { fbq: unknown }).fbq = fbq;
    trackMetaLead("quote", "abc-123", { content_ids: ["1000"] });
    expect(fbq).toHaveBeenCalledWith(
      "track",
      "Lead",
      { content_name: "site-contato-solicite-um-orcamento", content_ids: ["1000"] },
      { eventID: "abc-123" }
    );
  });

  it("trackMetaLead sem id não dispara (o servidor já conta)", () => {
    const fbq = vi.fn();
    (window as unknown as { fbq: unknown }).fbq = fbq;
    trackMetaLead("general", undefined);
    expect(fbq).not.toHaveBeenCalled();
  });

  it("evento personalizado usa trackCustom e erro do fbq não vaza", () => {
    const fbq = vi.fn(() => {
      throw new Error("boom");
    });
    (window as unknown as { fbq: unknown }).fbq = fbq;
    expect(() => trackMeta("ContinuarNoWhatsApp", undefined, undefined, true)).not.toThrow();
    expect(fbq).toHaveBeenCalledWith("trackCustom", "ContinuarNoWhatsApp", undefined, undefined);
  });
});

describe("readLeadEventId", () => {
  it("lê o eventId da resposta e tolera corpo inválido", async () => {
    expect(await readLeadEventId(new Response(JSON.stringify({ ok: true, eventId: "x" })))).toBe("x");
    expect(await readLeadEventId(new Response(JSON.stringify({ ok: true })))).toBeUndefined();
    expect(await readLeadEventId(new Response("não é json"))).toBeUndefined();
  });
});
