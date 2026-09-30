import { describe, expect, it } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import pt from "@/i18n/dictionaries/pt.json";
import {
  EMPTY_HOME_DOCUMENTS,
  HOME_SECTION_IDS,
  homeCategoriesSchema,
  homeAboutSchema,
  type HomeSectionId,
} from "@/modules/home/lib/home-content";
import {
  baseFormFor,
  collectHrefErrors,
  deepEqual,
  emptyCategoryItem,
  emptyForm,
  emptyHighlight,
  formatSavedAt,
  markOverLimit,
  messageForMutationError,
  moveItem,
  pickEditorDefaults,
  prefillCategoryItems,
  prefillHighlights,
  resolveImagePreview,
  setLayoutEnabled,
  validateSection,
  visibleErrors,
  type ValidationMessages,
} from "./home-editor-model";

const messages: ValidationMessages = {
  tooLong: "no máximo {max}",
  invalidHref: "link inválido",
  labelRequired: "título obrigatório",
  hrefRequired: "link obrigatório",
  imageRequired: "imagem obrigatória",
  invalid: "valor inválido",
};

const defaults = pickEditorDefaults({ pt: pt.home, en: en.home });

describe("emptyForm / baseFormFor", () => {
  it.each(HOME_SECTION_IDS)("formulário em branco da seção %s é um documento válido", (section) => {
    const result = validateSection(section, emptyForm(section) as never, messages);
    expect(result.errors).toEqual({});
    expect(result.data).not.toBeNull();
  });

  it("cada chamada devolve um objeto novo (o formulário nunca compartilha estado)", () => {
    expect(emptyForm("facade")).not.toBe(emptyForm("facade"));
    expect(emptyForm("facade").headline).not.toBe(emptyForm("facade").headline);
  });

  it("usa o documento salvo quando existe e o formulário em branco quando não", () => {
    const saved = { ...emptyForm("portalCta"), ctaHref: "/representantes" };
    const documents = { ...EMPTY_HOME_DOCUMENTS, portalCta: saved };
    expect(baseFormFor("portalCta", documents)).toBe(saved);
    expect(baseFormFor("facade", documents)).toEqual(emptyForm("facade"));
  });
});

describe("padrões do dicionário", () => {
  it("copia os padrões dos dois idiomas para o editor", () => {
    expect(defaults.pt.facade.headline).toBe(pt.home.facade.headline);
    expect(defaults.en.facade.headline).toBe(en.home.facade.headline);
    expect(defaults.pt.categories.items).toHaveLength(pt.home.categories.items.length);
  });

  it("une os parágrafos do dicionário por linha em branco (formato do editor)", () => {
    expect(defaults.pt.about.paragraphs).toBe(pt.home.about.paragraphs.join("\n\n"));
    expect(defaults.pt.about.paragraphs).toContain("\n\n");
  });

  it("pré-preenche os destaques emparelhando PT e EN pela posição", () => {
    const highlights = prefillHighlights(defaults);
    expect(highlights).toHaveLength(pt.home.about.highlights.length);
    expect(highlights[0].label).toEqual({
      pt: pt.home.about.highlights[0].label,
      en: en.home.about.highlights[0].label,
    });
    // O resultado precisa passar no schema do servidor (senão "Personalizar" já nasceria inválido).
    expect(homeAboutSchema.safeParse({ ...emptyForm("about"), highlights }).success).toBe(true);
  });

  it("pré-preenche os cards de categoria com a arte padrão em imagePath", () => {
    const items = prefillCategoryItems(defaults);
    expect(items).toHaveLength(pt.home.categories.items.length);
    for (const item of items) {
      expect(item.imageKey).toBeNull();
      expect(item.imagePath).toMatch(/^\/images\/home\/categorias\//);
      expect(item.label.pt).not.toBe("");
      expect(item.label.en).not.toBe("");
    }
    expect(homeCategoriesSchema.safeParse({ ...emptyForm("categories"), items }).success).toBe(true);
    // ... e sem erro de "renderizável" (título, link e imagem presentes).
    expect(validateSection("categories", { ...emptyForm("categories"), items }, messages).errors).toEqual({});
  });
});

describe("deepEqual", () => {
  it("ignora a ordem das chaves", () => {
    expect(deepEqual({ a: 1, b: { c: [1, 2] } }, { b: { c: [1, 2] }, a: 1 })).toBe(true);
  });

  it("distingue valores, tamanhos de lista e null", () => {
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(deepEqual(null, {})).toBe(false);
    expect(deepEqual({ a: null }, { a: undefined })).toBe(false);
    expect(deepEqual([], {})).toBe(false);
  });

  it("o formulário em branco equivale a si mesmo mesmo em ordem de chaves diferente", () => {
    const blank = emptyForm("facade");
    const reordered = Object.fromEntries(Object.entries(blank).reverse());
    expect(deepEqual(blank, reordered)).toBe(true);
  });
});

describe("moveItem / setLayoutEnabled", () => {
  it("move um item sem mutar a lista original", () => {
    const original = ["a", "b", "c"];
    expect(moveItem(original, 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(original, 2, 1)).toEqual(["a", "c", "b"]);
    expect(original).toEqual(["a", "b", "c"]);
  });

  it("ignora movimentos fora do intervalo", () => {
    expect(moveItem(["a", "b"], 0, -1)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], 1, 2)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], 5, 0)).toEqual(["a", "b"]);
  });

  it("liga/desliga só a seção pedida", () => {
    const layout = HOME_SECTION_IDS.map((id) => ({ id, enabled: true }));
    const next = setLayoutEnabled(layout, "about", false);
    expect(next.find((item) => item.id === "about")?.enabled).toBe(false);
    expect(next.filter((item) => item.enabled)).toHaveLength(HOME_SECTION_IDS.length - 1);
    expect(layout.every((item) => item.enabled)).toBe(true);
  });
});

describe("resolveImagePreview", () => {
  it("imagem enviada: usa a URL pública conhecida", () => {
    const key = "site/home/11111111-1111-1111-1111-111111111111.jpg";
    expect(resolveImagePreview({ imageKey: key, defaultPath: "/images/x.jpg", imageUrls: { [key]: "https://cdn/x.jpg" } })).toEqual({
      kind: "custom",
      url: "https://cdn/x.jpg",
    });
  });

  it("imagem enviada sem URL conhecida: continua 'custom', sem pré-visualização", () => {
    const key = "site/home/11111111-1111-1111-1111-111111111111.jpg";
    expect(resolveImagePreview({ imageKey: key, defaultPath: "/images/x.jpg", imageUrls: {} })).toEqual({
      kind: "custom",
      url: null,
    });
  });

  it("sem imagem enviada: cai na arte padrão, e sem padrão não há imagem", () => {
    expect(resolveImagePreview({ imageKey: null, defaultPath: "/images/x.jpg", imageUrls: {} })).toEqual({
      kind: "default",
      url: "/images/x.jpg",
    });
    expect(resolveImagePreview({ imageKey: null, defaultPath: null, imageUrls: {} })).toEqual({
      kind: "none",
      url: null,
    });
  });
});

describe("validateSection", () => {
  it("mapeia texto acima do teto para o campo e idioma certos", () => {
    const form = { ...emptyForm("facade"), headline: { pt: "x".repeat(121), en: "" } };
    const result = validateSection("facade", form, messages);
    expect(result.errors["headline.pt"]).toBe("no máximo 120");
    expect(result.data).toBeNull();
  });

  it.each(["javascript:alert(1)", "//evil.com", "data:text/html,x", "produtos"])(
    "rejeita o link inseguro %s no botão",
    (href) => {
      const form = { ...emptyForm("portalCta"), ctaHref: href };
      const result = validateSection("portalCta", form, messages);
      expect(result.errors.ctaHref).toBe("link inválido");
      expect(result.data).toBeNull();
    }
  );

  it.each(["/produtos", "#catalogo", "https://roco.com.br/x", "mailto:a@b.com", ""])(
    "aceita o link %s no botão",
    (href) => {
      const form = { ...emptyForm("portalCta"), ctaHref: href };
      expect(validateSection("portalCta", form, messages).errors).toEqual({});
    }
  );

  it("devolve o payload já aparado pelo schema", () => {
    const form = { ...emptyForm("portalCta"), headline: { pt: "  Portal ROCO  ", en: "" } };
    expect(validateSection("portalCta", form, messages).data?.headline.pt).toBe("Portal ROCO");
  });

  it("exige título nos destaques do institucional (o site descarta os sem título)", () => {
    const form = { ...emptyForm("about"), highlights: [emptyHighlight()] };
    const result = validateSection("about", form, messages);
    expect(result.errors["highlights.0.label"]).toBe("título obrigatório");
    expect(result.data).toBeNull();
  });

  it("aceita destaque com título em um idioma só", () => {
    const highlight = { ...emptyHighlight(), label: { pt: "Desde 2014", en: "" } };
    const form = { ...emptyForm("about"), highlights: [highlight] };
    expect(validateSection("about", form, messages).errors).toEqual({});
  });

  it("exige título, link e imagem em cada card de categoria", () => {
    const form = { ...emptyForm("categories"), items: [emptyCategoryItem()] };
    const { errors, data } = validateSection("categories", form, messages);
    expect(errors["items.0.label"]).toBe("título obrigatório");
    expect(errors["items.0.href"]).toBe("link obrigatório");
    expect(errors["items.0.image"]).toBe("imagem obrigatória");
    expect(data).toBeNull();
  });

  it("no card, link inseguro vence 'link obrigatório' e imagem enviada dispensa a padrão", () => {
    const item = {
      ...emptyCategoryItem(),
      label: { pt: "Novo", en: "" },
      href: "javascript:alert(1)",
      imageKey: "site/home/11111111-1111-1111-1111-111111111111.png",
    };
    const { errors } = validateSection("categories", { ...emptyForm("categories"), items: [item] }, messages);
    expect(errors["items.0.href"]).toBe("link inválido");
    expect(errors["items.0.image"]).toBeUndefined();
  });

  it("rejeita chave de imagem que não veio do presign", () => {
    const form = { ...emptyForm("facade"), imageKey: "produtos/qualquer.jpg" };
    const result = validateSection("facade", form, messages);
    expect(result.errors.imageKey).toBe("valor inválido");
  });

  it("rejeita quantidade de destaques fora do intervalo", () => {
    const form = { ...emptyForm("featured"), limit: 3 };
    expect(validateSection("featured", form, messages).errors.limit).toBe("valor inválido");
  });
});

describe("markOverLimit", () => {
  const product = (published: boolean, active = true) => ({ published, active });

  it("marca quem passa do limite entre os que o site realmente exibe", () => {
    const items = [product(true), product(true), product(true), product(true)];
    expect(markOverLimit(items, 2)).toEqual([false, false, true, true]);
  });

  it("produto não publicado ou inativo não ocupa vaga (nem é marcado)", () => {
    const items = [product(true), product(false), product(true), product(true, false), product(true)];
    expect(markOverLimit(items, 2)).toEqual([false, false, false, false, true]);
  });

  it("lista vazia e limite folgado não marcam ninguém", () => {
    expect(markOverLimit([], 4)).toEqual([]);
    expect(markOverLimit([product(true), product(true)], 12)).toEqual([false, false]);
  });
});

describe("messageForMutationError", () => {
  const messages = { forbidden: "sem permissão", imageMissing: "imagem sumiu", saveFailed: "falhou" };
  const trpcError = (code: string, message: string) => Object.assign(new Error(message), { data: { code } });

  it("permissão perdida", () => {
    expect(messageForMutationError(trpcError("FORBIDDEN", "Permissão negada"), messages)).toBe("sem permissão");
    expect(messageForMutationError(trpcError("UNAUTHORIZED", ""), messages)).toBe("sem permissão");
  });

  it("BAD_REQUEST de negócio (mensagem em texto) é imagem não encontrada", () => {
    expect(
      messageForMutationError(trpcError("BAD_REQUEST", "Imagem não encontrada. Envie o arquivo novamente."), messages)
    ).toBe("imagem sumiu");
  });

  it("BAD_REQUEST de validação do zod (mensagem em JSON) cai no erro genérico", () => {
    expect(messageForMutationError(trpcError("BAD_REQUEST", '[{"code":"too_big"}]'), messages)).toBe("falhou");
    expect(messageForMutationError(trpcError("BAD_REQUEST", ""), messages)).toBe("falhou");
  });

  it("qualquer outra coisa é genérica", () => {
    expect(messageForMutationError(trpcError("INTERNAL_SERVER_ERROR", "boom"), messages)).toBe("falhou");
    expect(messageForMutationError(new Error("rede"), messages)).toBe("falhou");
    expect(messageForMutationError(undefined, messages)).toBe("falhou");
  });
});

describe("formatSavedAt", () => {
  it("formata no idioma do painel e aceita Date e string ISO", () => {
    const iso = "2026-09-29T14:32:00.000Z";
    expect(formatSavedAt(iso, "pt")).toMatch(/^\d{2}\/\d{2}\/\d{4}/);
    expect(formatSavedAt(new Date(iso), "en")).toBe(formatSavedAt(iso, "en"));
  });

  it("data inválida vira travessão", () => {
    expect(formatSavedAt("não-é-data", "pt")).toBe("—");
  });
});

describe("erros visíveis (live vs. depois de tentar salvar)", () => {
  const cases: HomeSectionId[] = ["facade", "about", "categories", "featured", "portalCta"];

  it.each(cases)("%s: em branco não mostra erro nenhum antes de salvar", (section) => {
    expect(visibleErrors(section, emptyForm(section) as never, messages, false)).toEqual({});
  });

  it("antes de salvar só o link inseguro já digitado aparece; depois, tudo", () => {
    const item = { ...emptyCategoryItem(), href: "javascript:x" };
    const form = { ...emptyForm("categories"), ctaHref: "ftp://x", items: [item] };

    const live = visibleErrors("categories", form, messages, false);
    expect(live).toEqual({ ctaHref: "link inválido", "items.0.href": "link inválido" });

    const all = visibleErrors("categories", form, messages, true);
    expect(all["items.0.label"]).toBe("título obrigatório");
    expect(all.ctaHref).toBe("link inválido");
  });

  it("collectHrefErrors ignora link vazio (vazio = usa o padrão)", () => {
    expect(collectHrefErrors("portalCta", emptyForm("portalCta"), messages)).toEqual({});
  });
});
