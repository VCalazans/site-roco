import { describe, expect, it } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import pt from "@/i18n/dictionaries/pt.json";
import {
  DEFAULT_FACADE_IMAGE,
  EMPTY_HOME_DOCUMENTS,
  HOME_CONTENT_KEYS,
  HOME_CONTENT_SCHEMAS,
  HOME_SECTION_IDS,
  collectHomeImageKeys,
  homeDocumentForKey,
  parseHomeDocument,
  parseHomeRows,
  pickItemText,
  pickLocalized,
  resolveHomeContent,
  resolveHomeLayout,
  splitParagraphs,
  targetsHiddenSection,
  type HomeContentDocuments,
} from "./home-content";

const KEY = "site/home/123e4567-e89b-42d3-a456-426614174000.jpg";
const noImages: (key: string) => string | null = () => null;
const localized = (value: string, enValue = "") => ({ pt: value, en: enValue });

function resolve(
  documents: Partial<HomeContentDocuments>,
  locale: "pt" | "en" = "pt",
  imageUrl: (key: string) => string | null = noImages
) {
  return resolveHomeContent({
    documents: { ...EMPTY_HOME_DOCUMENTS, ...documents },
    locale,
    defaults: locale === "pt" ? pt.home : en.home,
    imageUrl,
  });
}

describe("chaves e documentos", () => {
  it("mapeia documento ↔ chave de site_settings", () => {
    expect(HOME_CONTENT_KEYS.portalCta).toBe("home.portal-cta");
    expect(homeDocumentForKey("home.facade")).toBe("facade");
    expect(homeDocumentForKey("contact.phone")).toBeNull();
  });
});

describe("schemas (escrita)", () => {
  const facade = HOME_CONTENT_SCHEMAS.facade;

  it("aceita documento válido e preenche padrões", () => {
    const result = facade.safeParse({ headline: localized("Fábrica"), ctaHref: "/produtos" });
    expect(result.success).toBe(true);
    expect(result.data?.imageKey).toBeNull();
    expect(result.data?.showCta).toBe(true);
    expect(result.data?.text).toEqual({ pt: "", en: "" });
  });

  it("rejeita link inseguro (XSS armazenado)", () => {
    expect(facade.safeParse({ ctaHref: "javascript:alert(1)" }).success).toBe(false);
    expect(facade.safeParse({ ctaHref: "//evil.com" }).success).toBe(false);
    expect(facade.safeParse({ ctaHref: "" }).success).toBe(true);
  });

  it("imagem só com chave gerada pelo presign (site/home/<uuid>.ext)", () => {
    expect(facade.safeParse({ imageKey: KEY }).success).toBe(true);
    expect(facade.safeParse({ imageKey: "products/1216/x.jpg" }).success).toBe(false);
    expect(facade.safeParse({ imageKey: "site/home/../../x.jpg" }).success).toBe(false);
    expect(facade.safeParse({ imageKey: "site/home/123e4567-e89b-42d3-a456-426614174000.svg" }).success).toBe(false);
  });

  it("caminho estático de imagem só em /images/", () => {
    const item = HOME_CONTENT_SCHEMAS.categories.shape.items.unwrap().unwrap().element;
    expect(item.safeParse({ label: localized("Gás"), href: "/produtos", imagePath: "/images/home/categorias/gas.jpg" }).success).toBe(true);
    expect(item.safeParse({ label: localized("Gás"), href: "/produtos", imagePath: "https://x.com/a.jpg" }).success).toBe(false);
  });

  it("layout rejeita seção repetida e aceita a ordem completa", () => {
    const layout = HOME_CONTENT_SCHEMAS.layout;
    expect(layout.safeParse({ sections: HOME_SECTION_IDS.map((id) => ({ id, enabled: true })) }).success).toBe(true);
    expect(
      layout.safeParse({ sections: [{ id: "about", enabled: true }, { id: "about", enabled: false }] }).success
    ).toBe(false);
    expect(layout.safeParse({ sections: [{ id: "hero", enabled: true }] }).success).toBe(false);
  });

  it("limite da vitrine entre 4 e 12", () => {
    const featured = HOME_CONTENT_SCHEMAS.featured;
    expect(featured.safeParse({ limit: 4 }).success).toBe(true);
    expect(featured.safeParse({ limit: 12 }).success).toBe(true);
    expect(featured.safeParse({ limit: 3 }).success).toBe(false);
    expect(featured.safeParse({ limit: 13 }).success).toBe(false);
    expect(featured.safeParse({}).data?.limit).toBe(8);
  });

  it("teto de destaques institucionais", () => {
    const about = HOME_CONTENT_SCHEMAS.about;
    const highlight = { label: localized("a"), value: localized("b") };
    expect(about.safeParse({ highlights: Array(8).fill(highlight) }).success).toBe(true);
    expect(about.safeParse({ highlights: Array(9).fill(highlight) }).success).toBe(false);
  });
});

describe("parseHomeDocument (leitura tolerante)", () => {
  it("aceita objeto e string JSON", () => {
    const doc = { headline: localized("Oi") };
    expect(parseHomeDocument("portalCta", doc)?.headline.pt).toBe("Oi");
    expect(parseHomeDocument("portalCta", JSON.stringify(doc))?.headline.pt).toBe("Oi");
  });

  it("qualquer coisa inválida vira null (= usar o padrão), nunca lança", () => {
    expect(parseHomeDocument("facade", "{json quebrado")).toBeNull();
    expect(parseHomeDocument("facade", 42)).toBeNull();
    expect(parseHomeDocument("facade", null)).toBeNull();
    expect(parseHomeDocument("facade", { ctaHref: "javascript:x" })).toBeNull();
  });

  it("documento salvo antes de um campo novo existir continua válido (compatível para frente)", () => {
    const legacy = { headline: localized("Fachada antiga") }; // sem imageAlt/eyebrow/text/ctaLabel/ctaHref
    const parsed = parseHomeDocument("facade", legacy);
    expect(parsed?.headline.pt).toBe("Fachada antiga");
    expect(parsed?.ctaHref).toBe("");
    expect(parsed?.ctaLabel).toEqual({ pt: "", en: "" });
    // default por função: dois parses nunca compartilham o mesmo objeto
    expect(parseHomeDocument("facade", {})?.eyebrow).not.toBe(parseHomeDocument("facade", {})?.eyebrow);
  });

  it("parseHomeRows ignora chaves que não são da home", () => {
    const docs = parseHomeRows([
      { key: "contact.phone", value: "554733352012" },
      { key: "home.featured", value: { limit: 6 } },
    ]);
    expect(docs.featured?.limit).toBe(6);
    expect(docs.facade).toBeNull();
  });

  it("collectHomeImageKeys junta fachada e cards, sem repetir", () => {
    const keys = collectHomeImageKeys({
      facade: HOME_CONTENT_SCHEMAS.facade.parse({ imageKey: KEY }),
      categories: HOME_CONTENT_SCHEMAS.categories.parse({
        items: [
          { label: localized("A"), href: "/produtos", imageKey: KEY },
          { label: localized("B"), href: "/produtos", imagePath: "/images/x.jpg" },
        ],
      }),
    });
    expect(keys).toEqual([KEY]);
  });
});

describe("resolveHomeLayout", () => {
  it("sem documento: todas as seções, na ordem padrão (fachada logo após o hero)", () => {
    expect(resolveHomeLayout(null)).toEqual(HOME_SECTION_IDS.map((id) => ({ id, enabled: true })));
    expect(HOME_SECTION_IDS[0]).toBe("facade");
  });

  it("respeita ordem/visibilidade salvas e completa as seções que faltarem", () => {
    const layout = resolveHomeLayout({
      sections: [
        { id: "featured", enabled: true },
        { id: "facade", enabled: false },
      ],
    });
    expect(layout.map((section) => section.id)).toEqual(["featured", "facade", "about", "categories", "portalCta"]);
    expect(layout.find((section) => section.id === "facade")?.enabled).toBe(false);
    expect(layout.find((section) => section.id === "about")?.enabled).toBe(true);
  });
});

describe("helpers de texto", () => {
  it("pickLocalized: idioma da página → padrão do dicionário (espaço conta como vazio)", () => {
    expect(pickLocalized(localized("PT", "EN"), "en", "padrão")).toBe("EN");
    expect(pickLocalized(localized("PT", "   "), "en", "default EN")).toBe("default EN");
    expect(pickLocalized(undefined, "pt", "padrão")).toBe("padrão");
  });

  it("pickItemText: idioma da página → outro idioma → vazio", () => {
    expect(pickItemText(localized("PT", "EN"), "pt")).toBe("PT");
    expect(pickItemText(localized("PT", ""), "en")).toBe("PT");
    expect(pickItemText(localized("", ""), "en")).toBe("");
  });

  it("splitParagraphs: linha em branco separa, quebra simples vira espaço", () => {
    expect(splitParagraphs("Primeiro\ncontinua.\n\n  Segundo.  \n\n\n")).toEqual(["Primeiro continua.", "Segundo."]);
    expect(splitParagraphs("   ")).toEqual([]);
  });
});

describe("resolveHomeContent", () => {
  it("sem nada salvo, devolve exatamente o padrão do dicionário (pt e en)", () => {
    const resolvedPt = resolve({});
    expect(resolvedPt.sections).toEqual([...HOME_SECTION_IDS]);
    expect(resolvedPt.facade.headline).toBe(pt.home.facade.headline);
    expect(resolvedPt.facade.imageUrl).toBe(DEFAULT_FACADE_IMAGE);
    expect(resolvedPt.facade.cta).toEqual(pt.home.facade.cta);
    expect(resolvedPt.about.paragraphs).toEqual(pt.home.about.paragraphs);
    expect(resolvedPt.about.highlights).toEqual(pt.home.about.highlights);
    expect(resolvedPt.categories.items).toHaveLength(pt.home.categories.items.length);
    expect(resolvedPt.categories.items[0]?.imageUrl).toBe(pt.home.categories.items[0]?.image);
    expect(resolvedPt.featured.limit).toBe(8);
    expect(resolvedPt.portalCta.headline).toBe(pt.home.portalCta.headline);

    const resolvedEn = resolve({}, "en");
    expect(resolvedEn.facade.headline).toBe(en.home.facade.headline);
    expect(resolvedEn.about.cta.label).toBe(en.home.about.cta.label);
  });

  it("campo EN vazio cai no padrão EN — nunca no texto PT salvo", () => {
    const facade = HOME_CONTENT_SCHEMAS.facade.parse({ headline: localized("Nossa fábrica nova") });
    expect(resolve({ facade }).facade.headline).toBe("Nossa fábrica nova");
    expect(resolve({ facade }, "en").facade.headline).toBe(en.home.facade.headline);
  });

  it("seções ocultas saem da lista de exibição", () => {
    const layout = HOME_CONTENT_SCHEMAS.layout.parse({
      sections: [
        { id: "about", enabled: false },
        { id: "portalCta", enabled: false },
      ],
    });
    expect(resolve({ layout }).sections).toEqual(["facade", "categories", "featured"]);
  });

  it("showCta=false remove o CTA da fachada; href vazio usa o do dicionário", () => {
    const hidden = HOME_CONTENT_SCHEMAS.facade.parse({ showCta: false });
    expect(resolve({ facade: hidden }).facade.cta).toBeNull();
    const labelOnly = HOME_CONTENT_SCHEMAS.facade.parse({ ctaLabel: localized("Veja") });
    expect(resolve({ facade: labelOnly }).facade.cta).toEqual({ label: "Veja", href: pt.home.facade.cta.href });
  });

  it("imagem enviada resolve pelo callback; sem URL cai na imagem padrão", () => {
    const facade = HOME_CONTENT_SCHEMAS.facade.parse({ imageKey: KEY });
    expect(resolve({ facade }, "pt", (key) => `https://cdn.example/${key}`).facade.imageUrl).toBe(
      `https://cdn.example/${KEY}`
    );
    expect(resolve({ facade }).facade.imageUrl).toBe(DEFAULT_FACADE_IMAGE);
  });

  it("cards inválidos são descartados; lista toda inválida volta ao padrão", () => {
    const categories = HOME_CONTENT_SCHEMAS.categories.parse({
      items: [
        { label: localized("Gás"), href: "/produtos?category=gas", imagePath: "/images/home/categorias/gas.jpg" },
        { label: localized(""), href: "/produtos", imagePath: "/images/x.jpg" },
        { label: localized("Sem imagem"), href: "/produtos" },
      ],
    });
    const items = resolve({ categories }).categories.items;
    expect(items).toEqual([
      { label: "Gás", href: "/produtos?category=gas", imageUrl: "/images/home/categorias/gas.jpg", alt: "" },
    ]);

    const allInvalid = HOME_CONTENT_SCHEMAS.categories.parse({ items: [{ label: localized(""), href: "" }] });
    expect(resolve({ categories: allInvalid }).categories.items).toHaveLength(pt.home.categories.items.length);
  });

  it("destaques null → padrão; lista personalizada usa o texto do outro idioma como reserva", () => {
    expect(resolve({ about: HOME_CONTENT_SCHEMAS.about.parse({}) }).about.highlights).toEqual(pt.home.about.highlights);
    const about = HOME_CONTENT_SCHEMAS.about.parse({
      highlights: [{ label: localized("Desde 2014"), value: localized("Solidez") }],
    });
    expect(resolve({ about }, "en").about.highlights).toEqual([{ label: "Desde 2014", value: "Solidez" }]);
  });

  it("parágrafos salvos por idioma; vazio usa os do dicionário", () => {
    const about = HOME_CONTENT_SCHEMAS.about.parse({ paragraphs: localized("Um.\n\nDois.") });
    expect(resolve({ about }).about.paragraphs).toEqual(["Um.", "Dois."]);
    expect(resolve({ about }, "en").about.paragraphs).toEqual(en.home.about.paragraphs);
  });

  it("CTA da fachada que aponta para seção oculta sai (sem link morto)", () => {
    const aboutHidden = HOME_CONTENT_SCHEMAS.layout.parse({ sections: [{ id: "about", enabled: false }] });
    // padrão do dicionário é `#sobre` → com a institucional oculta, o botão some
    expect(pt.home.facade.cta.href).toBe("#sobre");
    expect(resolve({ layout: aboutHidden }).facade.cta).toBeNull();
    // link explícito para outro destino continua valendo
    const facade = HOME_CONTENT_SCHEMAS.facade.parse({ ctaHref: "/produtos" });
    expect(resolve({ layout: aboutHidden, facade }).facade.cta?.href).toBe("/produtos");
    // com a institucional visível, o padrão volta
    expect(resolve({}).facade.cta?.href).toBe("#sobre");
  });

  it("targetsHiddenSection só considera âncoras de seções conhecidas", () => {
    expect(targetsHiddenSection("#sobre", ["facade"])).toBe(true);
    expect(targetsHiddenSection("#sobre", ["facade", "about"])).toBe(false);
    expect(targetsHiddenSection("#fachada", ["about"])).toBe(true);
    expect(targetsHiddenSection("#catalogo", [])).toBe(false);
    expect(targetsHiddenSection("/pt#sobre", [])).toBe(false);
  });

  it("showCatalogStats e limite da vitrine passam adiante", () => {
    const about = HOME_CONTENT_SCHEMAS.about.parse({ showCatalogStats: false });
    const featured = HOME_CONTENT_SCHEMAS.featured.parse({ limit: 12 });
    const resolved = resolve({ about, featured });
    expect(resolved.about.showCatalogStats).toBe(false);
    expect(resolved.featured.limit).toBe(12);
  });
});
