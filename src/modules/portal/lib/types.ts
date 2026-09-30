import type { Dictionary } from "@/i18n/get-dictionary";
import type { PasswordIssue } from "@/shared/lib/password-policy";
import type { RepresentativeEditErrorCode } from "./representative-types";

/** Estado de um link de conta vindo do servidor (`POST /api/account/token`). */
export type AccountLinkFailure = "invalid" | "expired" | "used";

/** Chave `portal.account` — páginas públicas de conta. */
export type PortalAccountDictionary = {
  backToLogin: string;
  emailLabel: string;
  errors: { invalidEmail: string; rateLimited: string; unavailable: string; generic: string };
  linkStates: { checking: string } & Record<`${AccountLinkFailure}Title`, string>;
  confirmEmail: {
    title: string;
    description: string;
    button: string;
    successTitle: string;
    successSubmitted: string;
    /** E-mail confirmado, mas outro cadastro com o mesmo CNPJ já está na fila (ou aprovado). */
    successCnpjConflict: string;
    successGeneric: string;
    loginButton: string;
    resendTitle: string;
    resendDescription: string;
    resendButton: string;
    resendSent: string;
  } & Record<AccountLinkFailure, string>;
  forgotPassword: { title: string; description: string; button: string; sentTitle: string; sent: string };
  resetPassword: {
    title: string;
    description: string;
    password: string;
    passwordConfirm: string;
    hint: string;
    button: string;
    requestNew: string;
    mismatch: string;
    passwordIssues: Record<PasswordIssue, string>;
  } & Record<AccountLinkFailure, string>;
};

/**
 * Situação do cadastro de quem entrou no portal sem perfil: o status do
 * representante; `cnpjConflict` quando o e-mail foi confirmado mas outro
 * cadastro com o mesmo CNPJ já estava na fila (ou aprovado); ou `none` quando
 * a conta não tem cadastro de representante.
 */
export type PendingAccessStatus = "draft" | "submitted" | "approved" | "rejected" | "cnpjConflict" | "none";

/** Chave `portal.pendingAccess` — aviso no `/portal` para quem ainda não foi aprovado. */
export type PortalPendingAccessDictionary = {
  submitted: { title: string; message: string; messageWithDate: string; hint: string };
  approved: { title: string; message: string };
  rejected: { title: string; message: string; notesLabel: string };
  draft: { title: string; message: string; action: string };
  cnpjConflict: { title: string; message: string };
  none: { title: string; message: string };
  company: string;
  steps: { title: string; sent: string; review: string; access: string };
  contactAction: string;
  siteAction: string;
};

/** Chave `portal.territory` — campo da área de atuação (base do IBGE) e filtro por estado. */
export type PortalTerritoryDictionary = {
  label: string;
  placeholder: string;
  helper: string;
  kinds: Record<"state" | "region" | "city", string>;
  noOptions: string;
  loading: string;
  loadError: string;
  /** Placeholder literal `{max}`. */
  limit: string;
  required: string;
  /** Cadastro antigo, só com texto livre. Placeholder literal `{text}`. */
  legacy: string;
  filterLabel: string;
  filterAll: string;
};

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
    /** `?error=rate_limited`: muitas tentativas (por IP ou por e-mail). */
    rateLimited: string;
    /** `?error=unavailable`: limitador de tentativas fora do ar. */
    unavailable: string;
    registerPrompt: string;
    registerLink: string;
    forgotPassword: string;
    /** `?error=email_not_verified`: senha certa, e-mail ainda não confirmado. */
    emailNotVerified: string;
    resendConfirmation: string;
    /** Avisos de sucesso vindos de outras telas (`?notice=`). */
    notices: { passwordReset: string };
  };
  /** Páginas públicas de conta: confirmar e-mail, esqueci a senha, nova senha. */
  account: PortalAccountDictionary;
  /** Aviso no `/portal` para quem entrou sem perfil (cadastro ainda não aprovado). */
  pendingAccess: PortalPendingAccessDictionary;
  /** Campo da área de atuação (wizard, conclusão do cadastro, edição e filtro do admin). */
  territory: PortalTerritoryDictionary;
  shell: {
    appName: string;
    /** Legenda ao lado da logo no topo da sidebar ("Portal"). */
    brandCaption: string;
    nav: {
      dashboard: string;
      onboarding: string;
      products: string;
      representatives: string;
      welcome: string;
      hero: string;
      homeContent: string;
      leads: string;
    };
    /** Títulos dos grupos da sidebar (chaves = `PortalNavGroupKey`). */
    navGroups: {
      overview: string;
      catalog: string;
      relationship: string;
      site: string;
      admin: string;
    };
    /** `aria-label` do landmark de navegação da sidebar. */
    navLabel: string;
    skipToContent: string;
    sidebar: {
      collapse: string;
      expand: string;
    };
    /** Busca de produtos da sidebar (só para quem tem `products:read`). */
    search: {
      label: string;
      placeholder: string;
      /** Dica de atalho fora do macOS / no macOS (nomes de tecla). */
      shortcut: string;
      shortcutMac: string;
    };
    viewSite: {
      label: string;
      aria: string;
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
  dashboard: PortalDashboardDictionary;
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
  products: PortalProductsDictionary;
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
      edit: string;
      disable: string;
      enable: string;
      delete: string;
    };
    edit: {
      title: string;
      save: string;
      saving: string;
      emailHint: string;
      errors: Record<RepresentativeEditErrorCode, string>;
    };
    fields: {
      disableReason: string;
      disabledAt: string;
      disabledBy: string;
      enableConfirm: string;
    };
    details: {
      title: string;
      name: string;
      email: string;
      companyName: string;
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
      /** Pré-cadastro aguardando o clique no link de confirmação. */
      emailNotVerified: string;
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
    /** Estado vazio das abas que não são "aguardando revisão" (`submitted`). */
    emptyByStatus: {
      draft: string;
      approved: string;
      rejected: string;
      hint: string;
    };
  };
  welcome: {
    hero: { title: string; subtitle: string; description: string };
    about: { title: string; body: string };
    catalog: { title: string; body: string; cta: string };
    dwSystem: {
      title: string;
      subtitle: string;
      intro: string;
      features: string[];
      outro: string;
    };
    materialsFeed: {
      title: string;
      subtitle: string;
      empty: string;
      /** Falha ao carregar (ex.: sessão sem `materials:read`) — nunca confundir com lista vazia. */
      error: string;
      forbidden: string;
      downloadLabel: string;
      /** PDF/imagem abrem no navegador — botão "Abrir", não "Baixar". */
      openLabel: string;
      watchLabel: string;
      /** Placeholder literal `{date}` — usar `interpolate()`. */
      publishedOn: string;
      /** Link para a biblioteca completa (`/portal/materiais`). */
      viewAll: string;
      newBadge: string;
    };
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
  materials: PortalMaterialsDictionary;
  roles: PortalRolesDictionary;
  settings: PortalSettingsDictionary;
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
    videoLabel: string;
    posterLabel: string;
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

export type PortalMaterialsLibraryDictionary = {
  title: string;
  subtitle: string;
  searchLabel: string;
  searchPlaceholder: string;
  sectorsLabel: string;
  all: string;
  recentTitle: string;
  newBadge: string;
  /** Placeholder literal `{count}`. */
  countOne: string;
  countOther: string;
  open: string;
  download: string;
  watch: string;
  /** Placeholder literal `{title}`. */
  downloadAria: string;
  /** Placeholder literal `{date}`. */
  publishedOn: string;
  /** Título do setor "other" (a categoria `other` do formulário é singular). */
  otherTitle: string;
  empty: { title: string; description: string };
  emptyFilter: { title: string; description: string; clear: string };
  error: string;
  retry: string;
  forbidden: string;
  fileTypes: {
    pdf: string;
    video: string;
    image: string;
    spreadsheet: string;
    presentation: string;
    document: string;
    archive: string;
    file: string;
  };
  /** Uma linha de apoio por setor, embaixo do título da seção. */
  sectors: {
    commercial_policy: string;
    logistics: string;
    contacts: string;
    training: string;
    other: string;
  };
  viewAsRepresentative: string;
  backToManage: string;
  previewNotice: string;
};

export type PortalMaterialsDictionary = {
  title: string;
  subtitle: string;
  /** Biblioteca somente-leitura do REPRESENTANTE, organizada por setor (revisão 2026-09-30). */
  library: PortalMaterialsLibraryDictionary;
  table: {
    title: string;
    category: string;
    type: string;
    publishedAt: string;
    status: string;
    size: string;
    actions: string;
  };
  status: { published: string; draft: string };
  categories: {
    commercial_policy: string;
    logistics: string;
    contacts: string;
    training: string;
    other: string;
  };
  form: {
    createTitle: string;
    editTitle: string;
    fields: {
      titlePt: string;
      titleEn: string;
      descriptionPt: string;
      descriptionEn: string;
      category: string;
      published: string;
      file: string;
    };
    upload: {
      dropzone: string;
      /** Placeholder literal `{formats}` — usar `interpolate()`. */
      helper: string;
      /** Placeholder literal `{size}` — usar `interpolate()`. */
      maxSize: string;
      /** Placeholder literal `{formats}` — usar `interpolate()`. */
      accepted: string;
      remove: string;
      replace: string;
      uploading: string;
      /** Falha de rede/servidor — quando não se sabe qual regra quebrou. */
      uploadError: string;
      /** Rejeição por formato. Placeholder literal `{formats}`. */
      errorType: string;
      /** Rejeição por tamanho. Placeholder literal `{size}`. */
      errorSize: string;
    };
    actions: { save: string; cancel: string; delete: string };
  };
  actions: { newMaterial: string };
  empty: { title: string; description: string };
  deleteConfirm: {
    title: string;
    message: string;
    confirm: string;
    cancel: string;
  };
  /** Erros em texto simples da rota de download (`/api/portal/materials/[id]/download`). */
  downloadErrors: { forbidden: string; notFound: string; unavailable: string };
};

export type PortalRolesDictionary = {
  title: string;
  subtitle: string;
  tabs: { profiles: string; matrix: string; users: string };
  table: {
    name: string;
    slug: string;
    description: string;
    usersCount: string;
    system: string;
    actions: string;
  };
  badges: { system: string; custom: string };
  form: {
    createTitle: string;
    editTitle: string;
    fields: {
      name: string;
      slug: string;
      slugHelper: string;
      description: string;
    };
    actions: { save: string; cancel: string; delete: string };
  };
  actions: { newProfile: string };
  deleteConfirm: {
    title: string;
    message: string;
    blockedMessage: string;
    confirm: string;
    cancel: string;
  };
  matrix: {
    title: string;
    subtitle: string;
    selectRole: string;
    adminLockedNote: string;
    saveButton: string;
    savedMessage: string;
    modules: Record<string, string>;
    actionsLabels: Record<string, string>;
  };
  users: {
    title: string;
    searchPlaceholder: string;
    table: {
      name: string;
      email: string;
      roles: string;
      status: string;
      actions: string;
    };
    assignRole: string;
    removeRole: string;
  };
  errors: {
    selfLockout: string;
    adminImmutable: string;
    roleHasUsers: string;
    cannotGrantAdmin: string;
    lastAdmin: string;
  };
};

type SettingsFieldCopy = { label: string; hint: string };
/** Campo de rede social: o `placeholder` mostra o que dá para digitar (@, nome, número). */
type SocialFieldCopy = SettingsFieldCopy & { placeholder: string };
type SettingsBlockCopy = { title: string; description: string };

export type PortalSettingsDictionary = {
  title: string;
  subtitle: string;
  blocks: {
    contact: SettingsBlockCopy;
    addresses: SettingsBlockCopy;
    social: SettingsBlockCopy;
    catalog: SettingsBlockCopy;
  };
  fields: {
    phone: SettingsFieldCopy;
    email: SettingsFieldCopy;
    addressMatriz: SettingsFieldCopy;
    addressFilial: SettingsFieldCopy;
    instagram: SocialFieldCopy;
    linkedin: SocialFieldCopy;
    youtube: SocialFieldCopy;
    whatsapp: SocialFieldCopy;
    catalogPdf: SettingsFieldCopy;
  };
  /** Bloco de redes sociais: prévia do link, teste, prévia do rodapé. Placeholders `{url}`/`{network}`. */
  social: {
    linkPreview: string;
    test: string;
    clear: string;
    useContactPhone: string;
    footerPreview: string;
    footerPreviewEmpty: string;
  };
  form: {
    save: string;
    saving: string;
    reset: string;
    unsaved: string;
    blockSaved: string;
    errors: {
      required: string;
      saveFailed: string;
      invalidUrl: string;
      /** Placeholder `{network}`. */
      wrongNetwork: string;
      invalidHandle: string;
      invalidEmail: string;
      invalidPhone: string;
      invalidWhatsapp: string;
      tooLong: string;
      invalidPath: string;
      storedInvalid: string;
    };
  };
  errors: {
    loadFailed: string;
  };
};

/** Assuntos de solicitação (espelha `CONTACT_SUBJECTS` do servidor). */
export type PortalLeadSubject = "call_back" | "quote" | "general" | "catalog" | "cart";

export type PortalDashboardDictionary = {
  title: string;
  /** Placeholder literal `{name}` — usar `interpolate()`. */
  welcome: string;
  subtitle: string;
  emptyState: string;
  partialError: string;
  /** `aria-label` da região dos indicadores. */
  indicatorsLabel: string;
  kpis: {
    /** `hint` com placeholder `{total}`. */
    published: { label: string; hint: string };
    featured: { label: string; hint: string };
    bestSeller: { label: string; hint: string };
    /** `ok` aparece no lugar de `hint` quando o indicador está zerado (é bom sinal). */
    noPhoto: { label: string; hint: string; ok: string };
    reviews: { label: string; hint: string; ok: string };
    /** `hint` com placeholder `{days}`. */
    leads: { label: string; hint: string };
  };
  quickActions: {
    title: string;
    newProduct: { label: string; hint: string };
    editHome: { label: string; hint: string };
    manageHero: { label: string; hint: string };
    viewSite: { label: string; hint: string };
  };
  recentLeads: {
    title: string;
    viewAll: string;
    empty: string;
    subjects: Record<PortalLeadSubject, string>;
  };
  health: {
    title: string;
    subtitle: string;
    published: string;
    withPhoto: string;
    /** Placeholders literais `{value}` e `{total}`. */
    ofTotal: string;
    healthy: string;
    noProducts: string;
    reviewNoPhoto: string;
    /** Placeholder literal `{count}`. */
    reviewUnpublished: string;
  };
};

export type PortalProductsDictionary = {
  title: string;
  subtitle: string;
  /** Subtítulo para quem só consulta o catálogo (sem `products:update`/`create`). */
  subtitleReadOnly: string;
  searchPlaceholder: string;
  /** Placeholder literal `{count}`. */
  count: { one: string; other: string };
  filters: {
    statusAll: string;
    categoryAll: string;
    quickLabel: string;
    featured: string;
    bestSeller: string;
    noImage: string;
    clear: string;
  };
  /** Textos do tooltip dos botões de destaque/campeão na tabela (a AÇÃO do clique). */
  flags: {
    featuredAdd: string;
    featuredRemove: string;
    bestSellerAdd: string;
    bestSellerRemove: string;
  };
  actions: {
    more: string;
    edit: string;
    viewOnSite: string;
    copyLink: string;
    shareWhatsapp: string;
    /** Abre a galeria com o download das imagens originais. */
    images: string;
    delete: string;
  };
  share: {
    /** Placeholders literais `{name}` e `{url}`. */
    message: string;
  };
  feedback: {
    linkCopied: string;
    copyFailed: string;
    saved: string;
    created: string;
    publishedOn: string;
    publishedOff: string;
    featuredAdded: string;
    featuredAddedUnpublished: string;
    featuredRemoved: string;
    bestSellerOn: string;
    bestSellerOff: string;
    deleted: string;
    actionFailed: string;
  };
  table: {
    sku: string;
    name: string;
    category: string;
    packaging: string;
    badges: string;
    status: string;
    updatedAt: string;
    actions: string;
    product: string;
    showcase: string;
    published: string;
    photos: string;
    noPhoto: string;
    /** Tem imagens, mas nenhuma marcada para o site. */
    noSitePhoto: string;
    /** Placeholder literal `{count}`. */
    onSite: string;
    /** Nome acessível do botão de fotos. Placeholder literal `{name}`. */
    openImages: string;
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
    /** Selo legado (migrado para "campeão de vendas") — não é mais oferecido no formulário. */
    top: string;
    tresEmUm: string;
    seguro: string;
  };
  form: {
    createTitle: string;
    editTitle: string;
    sections: {
      identification: { title: string; hint: string };
      copy: { title: string; hint: string };
      categories: { title: string; hint: string };
      showcase: { title: string; hint: string };
      packaging: { title: string; hint: string };
      images: { title: string; hint: string };
    };
    validation: {
      required: string;
      positiveNumber: string;
      /** Mesma embalagem (tipo + quantidade) repetida no formulário. */
      duplicatePackaging: string;
      wholeNumber: string;
    };
    errors: {
      duplicate: string;
      forbidden: string;
      invalid: string;
    };
    fields: {
      sku: string;
      erpCode: string;
      name: string;
      nameEn: string;
      description: string;
      descriptionEn: string;
      category: string;
      primaryCategory: string;
      primaryCategoryHelper: string;
      ncm: string;
      barcode: string;
      packagingType: string;
      unitsPerPack: string;
      published: string;
      publishedHelper: string;
      featured: string;
      featuredHelper: string;
      featuredOrder: string;
      featuredOrderHelper: string;
      bestSeller: string;
      bestSellerHelper: string;
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
      /** Botão que envia as fotos escolhidas (distinto do "Salvar Produto" do formulário). */
      upload: string;
      saveFirst: string;
      showOnSite: string;
      onSite: string;
      portalOnly: string;
      setCover: string;
      download: string;
      noSiteImages: string;
      updateError: string;
    };
    actions: {
      save: string;
      cancel: string;
      close: string;
      delete: string;
      publish: string;
      unpublish: string;
      addPackaging: string;
      removePackaging: string;
      viewOnSite: string;
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
  emptyFiltered: {
    title: string;
    description: string;
  };
  deleteConfirm: {
    title: string;
    message: string;
    /** Placeholder literal `{name}`. */
    messageNamed: string;
    confirm: string;
    cancel: string;
  };
  /** Galeria de download das imagens de um produto (todas, inclusive as só do portal). */
  imagesDialog: {
    /** Placeholder literal `{name}`. */
    title: string;
    description: string;
    downloadAll: string;
    download: string;
    /** Placeholder literal `{filename}`. */
    downloadNamed: string;
    close: string;
    empty: string;
  };
  /** Download em lote (ZIP) das imagens dos produtos do filtro atual. */
  bulkDownload: {
    button: string;
    title: string;
    scopeAll: string;
    scopeFiltered: string;
    /** Placeholder literal `{count}`. */
    imagesCount: { one: string; other: string };
    /** Placeholder literal `{count}`. */
    productsCount: { one: string; other: string };
    /** Placeholders literais `{images}`, `{products}` e `{size}`. */
    summary: string;
    hint: string;
    empty: string;
    /** Placeholders literais `{files}` e `{size}`. */
    tooLarge: string;
    confirm: string;
    started: string;
  };
  /** Textos das rotas de download (nomes dos arquivos e erros em texto simples). */
  downloads: {
    /** Sem extensão. Placeholder literal `{sku}`. */
    productZipName: string;
    /** Sem extensão. Placeholder literal `{date}` (AAAA-MM-DD). */
    catalogZipName: string;
    failureReport: { fileName: string; header: string };
    errors: {
      forbidden: string;
      notFound: string;
      empty: string;
      tooLarge: string;
      rateLimited: string;
      /** Teto de ZIPs simultâneos atingido (do usuário ou do servidor). */
      busy: string;
      unavailable: string;
    };
  };
};
