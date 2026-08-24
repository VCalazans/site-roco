import type { Dictionary } from "@/i18n/get-dictionary";

/**
 * Formato da chave `portal` nos dicionários (`src/i18n/dictionaries/{pt,en}.json`,
 * mesclado pelo agente `copywriter` — este módulo NUNCA toca nesses arquivos).
 * Onda 2: dicionários já trazem `onboarding`/`products`/`representatives`/
 * `errors`/`common` completos — tipo abaixo espelha exatamente as chaves
 * existentes hoje em `pt.json`/`en.json` (fonte da verdade).
 */
export type PortalDictionary = {
  login: {
    title: string;
    subtitle: string;
    googleButton: string;
    disclaimer: string;
    emailLabel: string;
    passwordLabel: string;
    signInButton: string;
    orDivider: string;
    invalidCredentials: string;
    registerPrompt: string;
    registerLink: string;
  };
  shell: {
    appName: string;
    nav: {
      dashboard: string;
      onboarding: string;
      products: string;
      representatives: string;
      welcome: string;
      hero: string;
    };
    comingSoon: string;
    userMenu: {
      profile: string;
      logout: string;
    };
    themeToggle: {
      light: string;
      dark: string;
      system: string;
    };
  };
  dashboard: {
    title: string;
    welcome: string;
    emptyState: string;
  };
  admin: {
    title: string;
    underConstruction: string;
  };
  onboarding: {
    title: string;
    subtitle: string;
    steps: {
      personal: { title: string; description: string };
      company: { title: string; description: string };
      territory: { title: string; description: string };
      documents: { title: string; description: string };
      review: { title: string; description: string };
    };
    fields: {
      fullName: string;
      email: string;
      phone: string;
      companyName: string;
      cnpj: string;
      region: string;
      notes: string;
    };
    upload: {
      dropzone: string;
      maxSize: string;
      accepted: string;
      remove: string;
    };
    actions: {
      next: string;
      back: string;
      saveDraft: string;
      submit: string;
    };
    status: {
      draft: string;
      submitted: string;
      approved: string;
      rejected: string;
    };
    completion: {
      title: string;
      subtitle: string;
      finish: string;
      done: string;
    };
    submitted: {
      title: string;
      message: string;
    };
    validation: {
      required: string;
      invalidCnpj: string;
      invalidPhone: string;
      fileTooLarge: string;
    };
  };
  products: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    table: {
      sku: string;
      name: string;
      category: string;
      packaging: string;
      badges: string;
      status: string;
      updatedAt: string;
      actions: string;
    };
    status: {
      published: string;
      unpublished: string;
      active: string;
      inactive: string;
    };
    badges: {
      nacional: string;
      universal: string;
      top: string;
      tresEmUm: string;
      seguro: string;
    };
    form: {
      createTitle: string;
      editTitle: string;
      fields: {
        sku: string;
        erpCode: string;
        name: string;
        nameEn: string;
        description: string;
        descriptionEn: string;
        category: string;
        ncm: string;
        barcode: string;
        packagingType: string;
        unitsPerPack: string;
        published: string;
      };
      packagingTypes: {
        peca: string;
        blister: string;
        caixa: string;
        sacoPlastico: string;
      };
      images: {
        title: string;
        dropzone: string;
        altText: string;
        cover: string;
        remove: string;
        uploadError: string;
      };
      actions: {
        save: string;
        cancel: string;
        delete: string;
        publish: string;
        unpublish: string;
      };
    };
    sync: {
      title: string;
      triggerButton: string;
      lastRun: string;
      statusIdle: string;
      statusRunning: string;
      statusError: string;
      successMessage: string;
      errorMessage: string;
    };
    empty: {
      title: string;
      description: string;
    };
    deleteConfirm: {
      title: string;
      message: string;
      confirm: string;
      cancel: string;
    };
  };
  representatives: {
    title: string;
    subtitle: string;
    table: {
      name: string;
      company: string;
      region: string;
      status: string;
      submittedAt: string;
      actions: string;
    };
    search: {
      placeholder: string;
    };
    filters: {
      region: string;
      regionAll: string;
      showDisabled: string;
    };
    actions: {
      viewDetails: string;
      disable: string;
      enable: string;
      delete: string;
    };
    fields: {
      disableReason: string;
      disabledAt: string;
      disabledBy: string;
      enableConfirm: string;
    };
    details: {
      title: string;
      cnpj: string;
      phone: string;
      region: string;
      submittedAt: string;
      reviewedAt: string;
      reviewedBy: string;
      notes: string;
      reviewNotes: string;
      documents: string;
      disableReason: string;
    };
    confirmDisable: {
      title: string;
      message: string;
      reasonLabel: string;
      confirm: string;
      cancel: string;
    };
    confirmEnable: {
      title: string;
      message: string;
      confirm: string;
      cancel: string;
    };
    confirmDelete: {
      title: string;
      message: string;
      confirm: string;
      cancel: string;
    };
    badge: {
      disabled: string;
    };
    emptySearch: {
      title: string;
      description: string;
    };
    review: {
      approve: string;
      reject: string;
      viewDocuments: string;
      notesLabel: string;
    };
    empty: {
      title: string;
      description: string;
    };
  };
  welcome: {
    hero: { title: string; subtitle: string; description: string };
    about: { title: string; body: string };
    catalog: { title: string; body: string; cta: string };
    contacts: { title: string; body: string; cta: string };
    commercialPolicy: { title: string; body: string; cta: string };
    logistics: { title: string; body: string; cta: string };
    dwSystem: {
      title: string;
      subtitle: string;
      intro: string;
      features: string[];
      outro: string;
      cta: string;
    };
    library: { title: string; body: string; cta: string };
    closing: { paragraph1: string; paragraph2: string };
    comingSoon: string;
  };
  errors: {
    unauthorized: string;
    forbidden: string;
    notFound: string;
    generic: string;
    sessionExpired: string;
  };
  common: {
    loading: string;
    save: string;
    cancel: string;
    confirm: string;
    search: string;
    filter: string;
    clear: string;
    backToSite: string;
  };
  hero: PortalHeroDictionary;
};

/**
 * `Dictionary` (src/i18n/get-dictionary.ts) é inferido a partir dos JSONs de
 * `src/i18n/dictionaries/`, que já trazem a chave `portal` completa. Mantemos
 * o cast estrutural aqui (em vez de `dictionary.portal` direto) só para
 * continuar validando `Dictionary["portal"]` contra `PortalDictionary` num
 * único ponto — se os JSONs divergirem deste tipo, o erro aparece aqui.
 */
export function getPortalDictionary(dictionary: Dictionary): PortalDictionary {
  return (dictionary as Dictionary & { portal: PortalDictionary }).portal;
}

export type PortalHeroDictionary = {
  title: string;
  subtitle: string;
  table: {
    slug: string;
    kind: string;
    headline: string;
    status: string;
    window: string;
    actions: string;
  };
  status: {
    published: string;
    unpublished: string;
    scheduled: string;
    expired: string;
  };
  kind: { youtube: string; upload: string };
  media: {
    posterAlt: string;
    youtubeHelper: string;
    uploadHelper: string;
    dropzone: string;
    dropzonePoster: string;
    maxSize: string;
    accepted: string;
    remove: string;
    uploadError: string;
  };
  form: {
    createTitle: string;
    editTitle: string;
    media: string;
    copy: string;
    ctas: string;
    playback: string;
    schedule: string;
    fields: {
      slug: string;
      kind: string;
      eyebrowPt: string;
      eyebrowEn: string;
      headlinePt: string;
      headlineEn: string;
      descriptionPt: string;
      descriptionEn: string;
      primaryCtaLabelPt: string;
      primaryCtaLabelEn: string;
      primaryCtaHref: string;
      secondaryCtaLabelPt: string;
      secondaryCtaLabelEn: string;
      secondaryCtaHref: string;
      loopWindowStart: string;
      loopWindowEnd: string;
      autoAdvance: string;
      muted: string;
      published: string;
      startsAt: string;
      endsAt: string;
    };
    actions: { save: string; cancel: string; delete: string };
    tabs: {
      media: string;
      copy: string;
      playback: string;
      ctas: string;
      schedule: string;
    };
  };
  actions: {
    newSlide: string;
    reorder: string;
    moveUp: string;
    moveDown: string;
  };
  empty: { title: string; description: string };
  deleteConfirm: {
    title: string;
    message: string;
    confirm: string;
    cancel: string;
  };
  carousel: { prev: string; next: string; of: string };
  loopWindowHelper: string;
  autoAdvanceHelper: string;
};
