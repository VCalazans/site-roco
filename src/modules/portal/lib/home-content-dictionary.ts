import type { Dictionary } from "@/i18n/get-dictionary";

type SectionCopy = { name: string; description: string };

/**
 * Formato de `portal.homeContent` nos dicionários (`src/i18n/dictionaries/{pt,en}.json`)
 * — texto do editor da página inicial (`/portal/pagina-inicial`, spec 001, RF18–RF21).
 *
 * Fica em arquivo PRÓPRIO (e não em `types.ts`) para o editor não competir com
 * quem mexe no restante do dicionário do portal. O teste
 * `home-content-dictionary.test.ts` atribui os dois JSONs a este tipo, então
 * chave faltando/sobrando quebra `tsc`/`next build`, e confere a paridade pt/en.
 *
 * Placeholders `{chave}` são resolvidos com `interpolate()`.
 */
export type PortalHomeContentDictionary = {
  title: string;
  subtitle: string;
  viewSite: string;
  /** Texto para leitor de tela em links que abrem em outra aba. */
  newTab: string;
  readOnly: string;
  loadError: string;
  retry: string;
  navigator: {
    title: string;
    description: string;
    heroName: string;
    heroDescription: string;
    heroAction: string;
    heroLocked: string;
    pinned: string;
    /** Rótulo VISÍVEL do interruptor (nome do ajuste, não do estado): o estado é a posição do interruptor. */
    showOnSite: string;
    /** Chip que sinaliza a seção oculta. */
    hidden: string;
    /** `{section}` */
    moveUpAria: string;
    /** `{section}` */
    moveDownAria: string;
    customized: string;
    usingDefault: string;
    unsaved: string;
    saveLayout: string;
    savingLayout: string;
    discardLayout: string;
    layoutUnsaved: string;
    layoutSaved: string;
  };
  sections: {
    facade: SectionCopy;
    about: SectionCopy;
    categories: SectionCopy;
    featured: SectionCopy;
    portalCta: SectionCopy;
  };
  editor: {
    save: string;
    saving: string;
    discard: string;
    reset: string;
    statusDefault: string;
    statusCustom: string;
    statusUnsaved: string;
    /** `{date}` */
    lastUpdated: string;
    defaultsNote: string;
    saved: string;
    resetDone: string;
    fixErrors: string;
    saveFailed: string;
    forbidden: string;
    imageMissing: string;
    resetFailed: string;
    resetDialog: {
      title: string;
      message: string;
      confirm: string;
      cancel: string;
    };
  };
  fields: {
    languagePt: string;
    languageEn: string;
    groupImage: string;
    groupTexts: string;
    groupButton: string;
    /** `{label}`, `{language}` */
    localizedLabel: string;
    emptyUsesDefault: string;
    /** `{count}`, `{max}` */
    counter: string;
    eyebrow: string;
    headline: string;
    description: string;
    text: string;
    paragraphs: string;
    emptyState: string;
    ctaLabel: string;
    ctaHref: string;
    showCta: string;
    imageAlt: string;
    itemLabel: string;
    itemValue: string;
    itemHref: string;
    /** Formatos aceitos em qualquer campo de link. */
    hrefHelper: string;
    /** `{href}` */
    hrefUsesDefault: string;
    paragraphsHelper: string;
    imageAltHelper: string;
  };
  image: {
    defaultBadge: string;
    customBadge: string;
    useDefault: string;
    /** Sem `R2_PUBLIC_URL` o servidor não devolve a URL da imagem enviada. */
    previewUnavailable: string;
    dropzone: string;
    /** `{size}` */
    maxSize: string;
    /** `{formats}` */
    accepted: string;
    /** `{formats}` */
    errorType: string;
    /** `{size}` */
    errorSize: string;
    uploadError: string;
    remove: string;
    replace: string;
    uploading: string;
  };
  facade: {
    imageHelper: string;
    showCtaHelper: string;
    /** Aviso: o link do botão é a âncora de uma seção oculta (o site esconde o botão). */
    ctaTargetHidden: string;
  };
  about: {
    showCatalogStats: string;
    showCatalogStatsHelper: string;
    highlights: {
      title: string;
      description: string;
      usingDefault: string;
      customize: string;
      useDefaultList: string;
      add: string;
      /** `{position}` */
      itemTitle: string;
      /** `{position}` */
      removeAria: string;
      /** `{position}` */
      moveUpAria: string;
      /** `{position}` */
      moveDownAria: string;
      /** `{max}` */
      maxReached: string;
      minOne: string;
    };
  };
  categories: {
    items: {
      title: string;
      description: string;
      usingDefault: string;
      customize: string;
      useDefaultList: string;
      add: string;
      newItem: string;
      /** `{position}`, `{label}` */
      itemTitle: string;
      /** `{name}` */
      expandAria: string;
      /** `{name}` */
      removeAria: string;
      /** `{name}` */
      moveUpAria: string;
      /** `{name}` */
      moveDownAria: string;
      /** `{max}` */
      maxReached: string;
      minOne: string;
      altHelper: string;
    };
  };
  featured: {
    limit: string;
    /** `{min}`, `{max}` */
    limitHelper: string;
    products: {
      title: string;
      description: string;
      immediate: string;
      fallback: string;
      empty: string;
      addLabel: string;
      addPlaceholder: string;
      /** `{sku}` */
      sku: string;
      /** `{count}` */
      typeMore: string;
      noOptions: string;
      loading: string;
      inShowcase: string;
      notPublished: string;
      bestSeller: string;
      overLimit: string;
      /** `{limit}` */
      overLimitHelp: string;
      /** `{name}` */
      removeAria: string;
      /** `{name}` */
      moveUpAria: string;
      /** `{name}` */
      moveDownAria: string;
      added: string;
      removed: string;
      reordered: string;
      actionFailed: string;
      loadFailed: string;
      noPermission: string;
      noRead: string;
    };
  };
  errors: {
    /** `{max}` */
    tooLong: string;
    invalidHref: string;
    labelRequired: string;
    hrefRequired: string;
    imageRequired: string;
    invalid: string;
  };
};

/**
 * Mesmo cast estrutural de `getPortalDictionary` (`types.ts`): `Dictionary` é
 * inferido dos JSONs, e aqui declaramos o formato que o editor espera.
 */
export function getPortalHomeContentDictionary(dictionary: Dictionary): PortalHomeContentDictionary {
  return (dictionary as Dictionary & { portal: { homeContent: PortalHomeContentDictionary } }).portal.homeContent;
}
