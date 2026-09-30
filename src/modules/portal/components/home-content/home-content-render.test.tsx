/**
 * Teste de renderização (SSR, sem navegador) do editor da página inicial. Não
 * há jsdom/testing-library no projeto, então `renderToString` é o que pega o
 * que o `tsc` não pega: chave de dicionário faltando virando "undefined" na
 * tela, `{placeholder}` sem resolver, exceção na renderização e vazamento da
 * palavra proibida. Interação (clique, digitação, upload) continua sendo
 * validada no navegador.
 */
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { describe, expect, it } from "vitest";
import { createPortalTheme } from "@/core/theme";
import { TRPCProvider } from "@/core/trpc-client";
import en from "@/i18n/dictionaries/en.json";
import pt from "@/i18n/dictionaries/pt.json";
import type { Locale } from "@/i18n/config";
import { HOME_SECTION_IDS, resolveHomeLayout } from "@/modules/home/lib/home-content";
import type { AppRouter } from "@/server/trpc/routers/_app";
import { AboutEditor } from "./about-editor";
import { CategoriesEditor } from "./categories-editor";
import { FacadeEditor } from "./facade-editor";
import { FeaturedEditor } from "./featured-editor";
import { HomeContentPageClient } from "./home-content-page-client";
import {
  emptyForm,
  pickEditorDefaults,
  prefillCategoryItems,
  prefillHighlights,
  type EditableSection,
  type SectionFormMap,
} from "./home-editor-model";
import { PortalCtaEditor } from "./portal-cta-editor";
import { SectionEditorFrame } from "./section-editor-frame";
import { SectionNavigator } from "./section-navigator";

const DICTIONARIES = { pt: pt.portal.homeContent, en: en.portal.homeContent } as const;
const defaults = pickEditorDefaults({ pt: pt.home, en: en.home });

/** Como o React escreve um valor dentro de um atributo HTML. */
const attr = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function render(node: ReactElement, locale: Locale = "pt"): string {
  const queryClient = new QueryClient();
  const trpcClient = createTRPCClient<AppRouter>({
    links: [httpBatchLink({ url: "http://localhost/api/trpc" })],
  });
  const html = renderToString(
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        <ThemeProvider theme={createPortalTheme(locale)}>{node}</ThemeProvider>
      </TRPCProvider>
    </QueryClientProvider>
  );
  // O React separa nós de texto vizinhos com `<!-- -->` no SSR; sem isto, "Título: 8" viraria "Título<!-- -->: <!-- -->8".
  return html.replace(/<!-- -->/g, "");
}

/** Atributos do `<button>` cujo texto contém `label` (`null` se não houver). */
function buttonAttributes(html: string, label: string): string | null {
  for (const match of html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)) {
    const text = match[2].replace(/<[^>]*>/g, "");
    if (text.includes(attr(label))) return match[1];
  }
  return null;
}

const isDisabledButton = (html: string, label: string) => buttonAttributes(html, label)?.includes('disabled=""') === true;
const isEnabledButton = (html: string, label: string) => buttonAttributes(html, label)?.includes('disabled=""') === false;

/** Sinais de que um texto não foi resolvido: valor ausente, objeto impresso ou `{placeholder}` intacto. */
function expectNoBrokenText(html: string) {
  // O Emotion injeta <style> no HTML do SSR; o CSS não é texto de tela e pode conter qualquer coisa.
  const markup = html.replace(/<style[\s\S]*?<\/style>/g, "");
  expect(markup).not.toMatch(/undefined|\[object Object\]|NaN/);
  expect(markup).not.toMatch(/\{[a-zA-Z]+\}/);
  expect(markup).not.toMatch(/carrinho/i);
}


function editorProps<K extends EditableSection>(
  section: K,
  locale: Locale,
  overrides: Partial<{
    form: SectionFormMap[K];
    errors: Record<string, string>;
    disabled: boolean;
    readOnly: boolean;
  }> = {}
) {
  return {
    form: emptyForm(section),
    onChange: () => {},
    locale,
    defaults,
    errors: {} as Record<string, string>,
    disabled: false,
    readOnly: false,
    dictionary: DICTIONARIES[locale],
    imageUrls: {},
    onImageUrl: () => {},
    ...overrides,
  };
}

describe.each(["pt", "en"] as const)("editores de seção (%s)", (locale) => {
  const dictionary = DICTIONARIES[locale];
  const site = locale === "pt" ? pt.home : en.home;

  it("fachada: mostra o padrão do site em PT e EN como placeholder, com o envio de imagem", () => {
    const html = render(<FacadeEditor {...editorProps("facade", locale)} />, locale);
    // Padrão de cada idioma visível no campo do idioma (não só do idioma do painel).
    expect(html).toContain(`placeholder="${attr(pt.home.facade.headline)}"`);
    expect(html).toContain(`placeholder="${attr(en.home.facade.headline)}"`);
    expect(html).toContain(`placeholder="${attr(pt.home.facade.imageAlt)}"`);
    expect(html).toContain(dictionary.fields.emptyUsesDefault);
    expect(html).toContain(interpolateLabel(dictionary.fields.localizedLabel, dictionary.fields.headline, "PT"));
    expect(html).toContain(interpolateLabel(dictionary.fields.localizedLabel, dictionary.fields.headline, "EN"));
    // Imagem padrão + envio (tamanho e formatos derivados da tabela central de uploads).
    expect(html).toContain(dictionary.image.defaultBadge);
    expect(html).toContain(attr(dictionary.image.replace));
    expect(html).toContain("10 MB");
    expect(html).toContain("JPG, PNG, WEBP");
    // Botão da seção, com o link padrão como dica.
    expect(html).toContain(dictionary.fields.hrefUsesDefault.replace("{href}", site.facade.cta.href));
    expectNoBrokenText(html);
  });

  it("fachada: sem botão, os campos do botão somem", () => {
    const form = { ...emptyForm("facade"), showCta: false };
    const html = render(<FacadeEditor {...editorProps("facade", locale, { form })} />, locale);
    expect(html).not.toContain(dictionary.fields.ctaHref);
    expectNoBrokenText(html);
  });

  it("fachada: somente leitura desabilita os campos e esconde o envio de imagem", () => {
    const html = render(
      <FacadeEditor {...editorProps("facade", locale, { disabled: true, readOnly: true })} />,
      locale
    );
    expect(html).toMatch(/<input[^>]*disabled=""/);
    expect(html).not.toContain('type="file"');
    expectNoBrokenText(html);
  });

  it("institucional: destaques padrão listados, com o botão de personalizar", () => {
    const html = render(<AboutEditor {...editorProps("about", locale)} />, locale);
    expect(html).toContain(dictionary.about.highlights.customize);
    expect(html).toContain(site.about.highlights[0].label);
    // O padrão dos parágrafos (unidos por linha em branco) aparece no campo do idioma certo.
    expect(html).toContain(attr(pt.home.about.paragraphs[0].slice(0, 40)));
    expect(html).toContain(attr(en.home.about.paragraphs[0].slice(0, 40)));
    expect(html).toContain(dictionary.fields.paragraphsHelper);
    expectNoBrokenText(html);
  });

  it("institucional: com destaques personalizados, mostra cada item com ações e limite", () => {
    const form = { ...emptyForm("about"), highlights: prefillHighlights(defaults) };
    const html = render(<AboutEditor {...editorProps("about", locale, { form })} />, locale);
    expect(html).toContain(dictionary.about.highlights.itemTitle.replace("{position}", "1"));
    expect(html).toContain(dictionary.about.highlights.removeAria.replace("{position}", "1"));
    expect(html).toContain(dictionary.about.highlights.add);
    expect(html).toContain(dictionary.about.highlights.useDefaultList);
    expect(html).not.toContain(dictionary.about.highlights.customize);
    expectNoBrokenText(html);
  });

  it("categorias: cards padrão e, personalizados, um cartão recolhível por item", () => {
    const initial = render(<CategoriesEditor {...editorProps("categories", locale)} />, locale);
    expect(initial).toContain(dictionary.categories.items.customize);
    expect(initial).toContain(site.categories.items[0].label);
    expectNoBrokenText(initial);

    const form = { ...emptyForm("categories"), items: prefillCategoryItems(defaults) };
    const html = render(<CategoriesEditor {...editorProps("categories", locale, { form })} />, locale);
    const firstLabel = locale === "pt" ? pt.home.categories.items[0].label : en.home.categories.items[0].label;
    expect(html).toContain(
      dictionary.categories.items.itemTitle.replace("{position}", "1").replace("{label}", attr(firstLabel))
    );
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('aria-expanded="true"');
    expect(html).toContain(dictionary.categories.items.add);
    expectNoBrokenText(html);
  });

  it("categorias: card com erro abre sozinho e mostra a mensagem no campo certo", () => {
    const form = { ...emptyForm("categories"), items: prefillCategoryItems(defaults) };
    const errors = { "items.1.label.pt": dictionary.errors.labelRequired, "items.1.href": dictionary.errors.hrefRequired };
    const html = render(<CategoriesEditor {...editorProps("categories", locale, { form, errors })} />, locale);
    expect(html.match(/aria-expanded="true"/g)).toHaveLength(1);
    expect(html).toContain(dictionary.errors.labelRequired);
    expect(html).toContain(dictionary.errors.hrefRequired);
    expectNoBrokenText(html);
  });

  it("produtos em destaque: limite da home e gestão da vitrine conforme a permissão", () => {
    const base = { ...editorProps("featured", locale), onNotify: () => {} };

    const full = render(<FeaturedEditor {...base} canReadProducts canManageProducts />, locale);
    expect(full).toContain(`${dictionary.featured.limit}: 8`);
    expect(full).toContain(dictionary.featured.products.title);
    expect(full).toContain(dictionary.featured.products.addLabel);
    expect(full).toContain(dictionary.featured.products.fallback);
    expect(full).toContain(dictionary.featured.products.immediate);
    expectNoBrokenText(full);

    const readOnlyProducts = render(<FeaturedEditor {...base} canReadProducts canManageProducts={false} />, locale);
    expect(readOnlyProducts).toContain(dictionary.featured.products.noPermission);
    expect(readOnlyProducts).not.toContain(dictionary.featured.products.addLabel);

    const noProducts = render(<FeaturedEditor {...base} canReadProducts={false} canManageProducts={false} />, locale);
    expect(noProducts).toContain(dictionary.featured.products.noRead);
    expectNoBrokenText(noProducts);
  });

  it("chamada do Portal ROCO: textos e botão com os padrões", () => {
    const html = render(<PortalCtaEditor {...editorProps("portalCta", locale)} />, locale);
    expect(html).toContain(`placeholder="${attr(pt.home.portalCta.headline)}"`);
    expect(html).toContain(`placeholder="${attr(en.home.portalCta.headline)}"`);
    expect(html).toContain(dictionary.fields.hrefUsesDefault.replace("{href}", site.portalCta.cta.href));
    expectNoBrokenText(html);
  });
});

/** "Título (PT)" a partir do template do dicionário. */
function interpolateLabel(template: string, label: string, language: string): string {
  return template.replace("{label}", label).replace("{language}", language);
}

describe.each(["pt", "en"] as const)("navegador de seções (%s)", (locale) => {
  const dictionary = DICTIONARIES[locale];
  const layout = resolveHomeLayout(null);
  const none = Object.fromEntries(HOME_SECTION_IDS.map((id) => [id, false])) as Record<
    (typeof HOME_SECTION_IDS)[number],
    boolean
  >;

  function navigator(overrides: Partial<Parameters<typeof SectionNavigator>[0]> = {}) {
    return (
      <SectionNavigator
        dictionary={dictionary}
        heroHref={`/${locale}/portal/hero`}
        canOpenHero
        layout={layout}
        layoutDirty={false}
        selected="facade"
        savedSections={none}
        dirtySections={none}
        canEdit
        savingLayout={false}
        onSelect={() => {}}
        onMove={() => {}}
        onToggle={() => {}}
        onSaveLayout={() => {}}
        onDiscardLayout={() => {}}
        {...overrides}
      />
    );
  }

  it("hero fixo no topo (com link para os slides) seguido das seções na ordem do layout", () => {
    const html = render(navigator(), locale);
    const positions = [
      dictionary.navigator.heroName,
      dictionary.sections.facade.name,
      dictionary.sections.about.name,
      dictionary.sections.categories.name,
      dictionary.sections.featured.name,
      dictionary.sections.portalCta.name,
    ].map((name) => html.indexOf(attr(name)));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(html).toContain(`href="/${locale}/portal/hero"`);
    expect(html).toContain('aria-current="true"');
    expectNoBrokenText(html);
  });

  it("interruptor: rótulo visível igual ao nome acessível, com a seção como descrição", () => {
    const html = render(navigator(), locale);
    // Um interruptor por seção editável, todos com o mesmo rótulo visível (WCAG 2.5.3: o nome acessível é o rótulo).
    expect(html.match(new RegExp(attr(dictionary.navigator.showOnSite), "g"))).toHaveLength(HOME_SECTION_IDS.length);
    for (const id of HOME_SECTION_IDS) {
      expect(html).toContain(`aria-describedby="home-nav-${id}-name"`);
      expect(html).toContain(`id="home-nav-${id}-name"`);
    }
    expect(html).not.toContain(dictionary.navigator.hidden);
  });

  it("seção oculta ganha o chip 'Oculta'", () => {
    const hiddenLayout = layout.map((item) => (item.id === "about" ? { ...item, enabled: false } : item));
    const html = render(navigator({ layout: hiddenLayout }), locale);
    expect(html.match(new RegExp(attr(dictionary.navigator.hidden), "g"))).toHaveLength(1);
  });

  it("setas têm nome acessível por seção; as pontas da lista não têm seta inválida", () => {
    const html = render(navigator(), locale);
    const up = dictionary.navigator.moveUpAria.replace("{section}", dictionary.sections.facade.name);
    const down = dictionary.navigator.moveDownAria.replace("{section}", dictionary.sections.portalCta.name);
    expect(html).toMatch(new RegExp(`<button[^>]*disabled=""[^>]*aria-label="${attr(up)}"`));
    expect(html).toMatch(new RegExp(`<button[^>]*disabled=""[^>]*aria-label="${attr(down)}"`));
  });

  it("ordem/visibilidade alterada: avisa e habilita o botão de salvar", () => {
    const clean = render(navigator(), locale);
    expect(clean).not.toContain(dictionary.navigator.layoutUnsaved);
    expect(isDisabledButton(clean, dictionary.navigator.saveLayout)).toBe(true);

    const dirty = render(navigator({ layoutDirty: true }), locale);
    expect(dirty).toContain(dictionary.navigator.layoutUnsaved);
    expect(isEnabledButton(dirty, dictionary.navigator.saveLayout)).toBe(true);
  });

  it("estado de cada seção: padrão, personalizada ou não salva", () => {
    const html = render(
      navigator({
        savedSections: { ...none, about: true },
        dirtySections: { ...none, categories: true },
      }),
      locale
    );
    expect(html).toContain(dictionary.navigator.customized);
    expect(html).toContain(dictionary.navigator.unsaved);
    expect(html).toContain(dictionary.navigator.usingDefault);
  });

  it("sem permissão de editar: nada de setas nem de salvar; sem acesso ao hero: cartão sem link", () => {
    const html = render(navigator({ canEdit: false, canOpenHero: false }), locale);
    expect(html).not.toContain(dictionary.navigator.saveLayout);
    expect(html).not.toContain("aria-label=\"" + attr(dictionary.navigator.moveUpAria.replace("{section}", dictionary.sections.about.name)));
    expect(html).not.toContain(`href="/${locale}/portal/hero"`);
    expect(html).toContain(attr(dictionary.navigator.heroLocked));
    expectNoBrokenText(html);
  });
});

describe.each(["pt", "en"] as const)("moldura do editor (%s)", (locale) => {
  const dictionary = DICTIONARIES[locale];

  function frame(overrides: Partial<Parameters<typeof SectionEditorFrame>[0]> = {}) {
    return (
      <SectionEditorFrame
        headingId="home-section-test"
        title="Fachada"
        description="Descrição"
        locale={locale}
        dictionary={dictionary.editor}
        hasSaved={false}
        updatedAt={null}
        dirty={false}
        canEdit
        saving={false}
        resetting={false}
        onSave={() => {}}
        onDiscard={() => {}}
        onReset={() => {}}
        {...overrides}
      >
        <p>conteúdo</p>
      </SectionEditorFrame>
    );
  }

  it("seção com o padrão: explica o placeholder e desabilita restaurar/descartar/salvar", () => {
    const html = render(frame(), locale);
    expect(html).toContain(dictionary.editor.statusDefault);
    expect(html).toContain(attr(dictionary.editor.defaultsNote));
    for (const label of [dictionary.editor.reset, dictionary.editor.discard, dictionary.editor.save]) {
      expect(isDisabledButton(html, label)).toBe(true);
    }
    expectNoBrokenText(html);
  });

  it("seção personalizada e alterada: mostra a última gravação e habilita as ações", () => {
    const html = render(
      frame({ hasSaved: true, dirty: true, updatedAt: "2026-09-29T14:32:00.000Z" }),
      locale
    );
    expect(html).toContain(dictionary.editor.statusUnsaved);
    expect(html).not.toContain(attr(dictionary.editor.defaultsNote));
    expect(html).toContain(dictionary.editor.lastUpdated.split("{date}")[0]);
    expect(isEnabledButton(html, dictionary.editor.save)).toBe(true);
    expect(isEnabledButton(html, dictionary.editor.discard)).toBe(true);
    expect(isEnabledButton(html, dictionary.editor.reset)).toBe(true);
    expectNoBrokenText(html);
  });

  it("sem permissão de editar: a barra de ações não existe", () => {
    const html = render(frame({ canEdit: false }), locale);
    expect(html).not.toContain(dictionary.editor.save);
    expect(html).not.toContain(dictionary.editor.reset);
  });
});

describe.each(["pt", "en"] as const)("página (%s)", (locale) => {
  const dictionary = DICTIONARIES[locale];
  const props = {
    locale,
    dictionary,
    defaults,
    canEdit: true,
    canReadProducts: true,
    canEditProducts: true,
    canOpenHero: true,
  };

  it("cabeçalho com título, subtítulo e o link 'Ver site' em nova aba", () => {
    const html = render(<HomeContentPageClient {...props} />, locale);
    expect(html).toContain(dictionary.title);
    expect(html).toContain(attr(dictionary.subtitle));
    expect(html).toContain(dictionary.viewSite);
    expect(html).toMatch(new RegExp(`<a[^>]*href="/${locale}"[^>]*target="_blank"[^>]*rel="noopener noreferrer"|<a[^>]*target="_blank"[^>]*href="/${locale}"`));
    expect(html).toContain(dictionary.newTab);
    expect(html).not.toContain(dictionary.readOnly);
    expectNoBrokenText(html);
  });

  it("sem permissão de edição: avisa que é somente leitura", () => {
    const html = render(<HomeContentPageClient {...props} canEdit={false} />, locale);
    expect(html).toContain(attr(dictionary.readOnly));
  });
});
