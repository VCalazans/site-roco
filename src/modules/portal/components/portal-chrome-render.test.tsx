/**
 * Testes de renderização (SSR, sem navegador) da moldura do portal: logo, shell
 * (sidebar agrupada, busca, "Ver site"), painel, listagem de produtos e
 * configurações. Mesmo critério de `leads-render.test.tsx`: não há
 * jsdom/testing-library no projeto, então `renderToString` pega o que o `tsc`
 * não pega — chave de dicionário faltando virando "undefined", placeholder
 * `{x}` sem resolver e exceção durante a renderização. Interação (clique,
 * atalho, URL) continua sendo validada no navegador.
 */
import type { ComponentProps, ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { describe, expect, it, vi } from "vitest";
import { createPortalTheme } from "@/core/theme";
import { TRPCProvider } from "@/core/trpc-client";
import type { Locale } from "@/i18n/config";
import en from "@/i18n/dictionaries/en.json";
import pt from "@/i18n/dictionaries/pt.json";
import type { AppRouter } from "@/server/trpc/routers/_app";
import { buildPortalNavItems } from "@/modules/portal/lib/nav-items";
import type { PortalPermissionUser } from "@/modules/portal/lib/permissions";
import type { ProductListItem } from "@/modules/portal/lib/product-types";
import type { PortalDictionary } from "@/modules/portal/lib/types";

// Estado que os mocks de navegação leem: rota atual (por locale) e a URL da listagem.
const navigation = vi.hoisted(() => ({
  pathname: "/pt/portal/produtos",
  search: "status=published&filter=featured",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {}, back: () => {} }),
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

// Importados DEPOIS do mock (o vitest içosa o `vi.mock`, mas a ordem documenta a dependência).
import { PortalShell } from "./portal-shell";
import { DashboardSummary } from "./dashboard-summary";
import { LoginCard } from "./login-card";
import { NavList } from "./shell/nav-list";
import { PortalLogo } from "./shared/portal-logo";
import { ProductsPageClient } from "./products/products-page-client";
import { ProductTable } from "./products/product-table";
import { SettingsPageClient } from "./settings/settings-page-client";
import { WelcomeHero } from "./welcome/welcome-hero";

const PORTALS = { pt: pt.portal as unknown as PortalDictionary, en: en.portal as unknown as PortalDictionary };
const BRAND = { pt: pt.navigation.brand, en: en.navigation.brand };

const ADMIN: PortalPermissionUser = { roles: ["admin"], permissions: [] };
const REPRESENTATIVE: PortalPermissionUser = {
  roles: ["representative"],
  permissions: ["products:read", "materials:read", "product_images:download"],
};

function newQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function render(node: ReactElement, locale: Locale = "pt", queryClient = newQueryClient()): string {
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

/** O React separa nós de texto adjacentes com <!-- --> no SSR; para comparar texto corrido, tira-os. */
function text(html: string): string {
  return html.replace(/<!-- -->/g, "");
}

/** Sinais de texto não resolvido (o CSS que o Emotion injeta no SSR não conta). */
function expectNoBrokenText(html: string) {
  const markup = html.replace(/<style[\s\S]*?<\/style>/g, "");
  expect(markup).not.toMatch(/undefined|\[object Object\]|NaN/);
  expect(markup).not.toMatch(/\{[a-zA-Z]+\}/);
}

function navItemsFor(user: PortalPermissionUser, locale: Locale) {
  const portal = PORTALS[locale];
  return buildPortalNavItems(
    `/${locale}/portal`,
    {
      ...portal.shell.nav,
      materials: portal.materials.title,
      roles: portal.roles.title,
      settings: portal.settings.title,
    },
    user
  );
}

// ---------------------------------------------------------------------------

const LOGIN_CARD_PROPS: ComponentProps<typeof LoginCard> = {
  logoAlt: "ROCO",
  title: "t",
  subtitle: "s",
  disclaimer: "d",
  emailLabel: "e",
  passwordLabel: "p",
  signInButtonLabel: "i",
  forgotPassword: { href: "/pt/portal/esqueci-senha", label: "Esqueci minha senha" },
  registerPrompt: "r",
  registerLinkLabel: "l",
  registerHref: "/pt/representantes",
  credentialsAction: () => {},
};

describe("LoginCard", () => {
  it("sem Google configurado, não oferece o botão do Google", () => {
    const html = render(<LoginCard {...LOGIN_CARD_PROPS} />);
    expect(html).not.toContain("Entrar com Google");
    expect(html).toContain('href="/pt/portal/esqueci-senha"');
  });

  it("com Google habilitado, mostra o botão e o divisor", () => {
    const html = render(
      <LoginCard
        {...LOGIN_CARD_PROPS}
        google={{ buttonLabel: "Entrar com Google", orDividerLabel: "ou", action: () => {} }}
      />
    );
    expect(html).toContain("Entrar com Google");
  });

  it("erro de e-mail não confirmado oferece reenviar a confirmação", () => {
    const html = render(
      <LoginCard
        {...LOGIN_CARD_PROPS}
        errorMessage={PORTALS.pt.login.emailNotVerified}
        errorAction={{ href: "/pt/portal/confirmar-email", label: PORTALS.pt.login.resendConfirmation }}
      />
    );
    expect(html).toContain(PORTALS.pt.login.emailNotVerified);
    expect(html).toContain('href="/pt/portal/confirmar-email"');
  });

  it("mostra o aviso de senha alterada", () => {
    const html = render(<LoginCard {...LOGIN_CARD_PROPS} noticeMessage={PORTALS.pt.login.notices.passwordReset} />);
    expect(html).toContain(PORTALS.pt.login.notices.passwordReset);
  });
});

describe("PortalLogo", () => {
  it("renderiza as duas versões com a proporção do arquivo e o mesmo alt", () => {
    const html = render(<PortalLogo alt="ROCO" width={72} />);
    expect(html).toContain("roco-logo-blue.png");
    expect(html).toContain("roco-logo-white.png");
    // 289×125 -> 72×31: a altura vem da proporção, nunca de um quadrado.
    expect(html).toMatch(/width="72"[^>]*height="31"|height="31"[^>]*width="72"/);
    expect((html.match(/alt="ROCO"/g) ?? []).length).toBe(2);
    expect(html).toContain("portal-logo-light");
    expect(html).toContain("portal-logo-dark");
  });

  it("a variante com slogan usa os arquivos 918×506", () => {
    const html = render(<PortalLogo alt="ROCO" variant="slogan" width={168} eager />);
    expect(html).toContain("roco-logo-slogan-blue.png");
    expect(html).toContain("roco-logo-slogan-white.png");
    expect(html).toMatch(/height="93"/);
    // Acima da dobra: prioridade de rede alta, sem `preload` (que baixaria as duas).
    expect(html).toContain('fetchPriority="high"');
    expect(html).not.toContain('rel="preload"');
  });

  it("nenhuma tela do portal usa mais a logo antiga quadrada", () => {
    const login = render(<LoginCard {...LOGIN_CARD_PROPS} />);
    const welcome = render(<WelcomeHero content={PORTALS.pt.welcome.hero} logoAlt="ROCO" />);
    for (const html of [login, welcome]) {
      expect(html).toContain("roco-logo-slogan");
      expect(html).not.toContain("hero%2Froco-logo.png");
      expect(html).not.toContain("images/hero/roco-logo.png");
    }
  });
});

// ---------------------------------------------------------------------------

describe.each(["pt", "en"] as const)("shell do portal (%s)", (locale) => {
  const portal = PORTALS[locale];
  const shellLabels = portal.shell;

  function renderShell(user: PortalPermissionUser, productSearchHref?: string) {
    navigation.pathname = `/${locale}/portal/produtos`;
    return render(
      <PortalShell
        labels={shellLabels}
        logoAlt={BRAND[locale]}
        menuLabels={{ open: "menu", close: "close" }}
        locale={locale}
        navItems={navItemsFor(user, locale)}
        productSearchHref={productSearchHref}
        user={{ name: "Victor Calazans", email: "victor@roco.com.br" }}
        logoutAction={async () => {}}
      >
        <p>conteúdo da página</p>
      </PortalShell>,
      locale
    );
  }

  it("agrupa a navegação do admin e marca o item ativo com aria-current", () => {
    const html = renderShell(ADMIN, `/${locale}/portal/produtos`);
    for (const group of ["overview", "catalog", "relationship", "site", "admin"] as const) {
      expect(html).toContain(shellLabels.navGroups[group]);
    }
    for (const item of ["dashboard", "products", "leads", "representatives", "homeContent", "hero"] as const) {
      expect(html).toContain(shellLabels.nav[item]);
    }
    // Rota atual mockada: /pt/portal/produtos.
    const href = `/${locale}/portal/produtos`;
    expect(html).toMatch(
      new RegExp(`href="${href}"[^>]*aria-current="page"|aria-current="page"[^>]*href="${href}"`)
    );
    // O painel (prefixo de todas as rotas) NÃO fica marcado junto.
    expect(html.match(/aria-current="page"/g)?.length).toBe(1);
    expect(html).toContain(`aria-label="${shellLabels.navLabel}"`);
    expectNoBrokenText(html);
  });

  it("mostra a busca de produtos só quando recebe o destino, com a dica de atalho", () => {
    const withSearch = renderShell(ADMIN, `/${locale}/portal/produtos`);
    expect(withSearch).toContain('role="search"');
    expect(withSearch).toContain(`placeholder="${shellLabels.search.placeholder}"`);
    expect(withSearch).toContain(shellLabels.search.shortcut);

    const withoutSearch = renderShell({ roles: [], permissions: [] });
    expect(withoutSearch).not.toContain('role="search"');
  });

  it("tem 'Ver site' para uma nova aba, pular para o conteúdo e o menu da conta", () => {
    const html = renderShell(ADMIN, `/${locale}/portal/produtos`);
    expect(html).toContain(`href="/${locale}"`);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain(shellLabels.viewSite.label);
    expect(html).toContain(`aria-label="${shellLabels.viewSite.aria}"`);
    expect(html).toContain('href="#portal-main"');
    expect(html).toContain(shellLabels.skipToContent);
    expect(html).toContain(`aria-label="${shellLabels.userMenu.profile}"`);
    expect(html).toContain(`aria-label="${shellLabels.sidebar.collapse}"`);
    expect(html).toContain('id="portal-main"');
    expect(html).toContain("conteúdo da página");
  });

  it("representante não vê os grupos de site nem de administração", () => {
    const html = renderShell(REPRESENTATIVE, `/${locale}/portal/produtos`);
    expect(html).not.toContain(shellLabels.navGroups.site);
    expect(html).not.toContain(shellLabels.navGroups.admin);
    expect(html).not.toContain(shellLabels.nav.homeContent);
    expect(html).not.toContain(shellLabels.nav.leads);
    expect(html).toContain(shellLabels.nav.welcome);
    expectNoBrokenText(html);
  });
});

describe("NavList recolhida", () => {
  it("troca títulos de grupo por divisores e nomeia cada botão pelo rótulo", () => {
    const portal = PORTALS.pt;
    const html = render(
      <NavList
        navItems={navItemsFor(ADMIN, "pt")}
        groupLabels={portal.shell.navGroups}
        navLabel={portal.shell.navLabel}
        comingSoonLabel={portal.shell.comingSoon}
        pathname="/pt/portal/produtos"
        onNavigate={() => {}}
        collapsed
      />
    );
    expect(html).not.toContain("MuiListSubheader-root");
    expect(html).toContain("MuiDivider-root");
    expect(html).toContain(`aria-label="${portal.shell.nav.products}"`);
    // O nome do grupo continua acessível no <ul> quando não há título visível.
    expect(html).toContain(`aria-label="${portal.shell.navGroups.catalog}"`);
  });
});

// ---------------------------------------------------------------------------

function seededClient() {
  const client = newQueryClient();
  const key = (path: string[], input?: unknown) => [path, { ...(input === undefined ? {} : { input }), type: "query" }];
  client.setQueryData(key(["products", "stats"]), {
    total: 737,
    published: 700,
    active: 737,
    unpublished: 37,
    featured: 12,
    bestSeller: 57,
    publishedWithoutImage: 9,
  });
  client.setQueryData(key(["representatives", "stats"]), {
    total: 20,
    draft: 1,
    submitted: 3,
    approved: 15,
    rejected: 1,
    disabled: 0,
  });
  client.setQueryData(key(["leads", "stats"]), {
    windowDays: 30,
    lastDays: 18,
    bySubject: { call_back: 2, quote: 5, general: 3, catalog: 4, cart: 4 },
    total: 90,
    recent: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        createdAt: "2026-09-29T14:32:00.000Z",
        subject: "cart",
        name: "João Silva",
        companyName: "Empresa Ltda",
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        createdAt: "2026-09-28T10:00:00.000Z",
        subject: "call_back",
        name: "Maria Souza",
        companyName: null,
      },
    ],
  });
  return client;
}

describe.each(["pt", "en"] as const)("painel (%s)", (locale) => {
  const portal = PORTALS[locale];
  const dashboard = portal.dashboard;
  const base = `/${locale}/portal`;

  it("admin: indicadores clicáveis, atalhos, solicitações recentes e saúde do catálogo", () => {
    const html = render(
      <DashboardSummary portal={portal} user={ADMIN} locale={locale} />,
      locale,
      seededClient()
    );

    for (const kpi of ["published", "featured", "bestSeller", "noPhoto", "reviews", "leads"] as const) {
      expect(html).toContain(dashboard.kpis[kpi].label);
    }
    // Cada indicador leva para a tela já filtrada.
    expect(html).toContain(`href="${base}/produtos?status=published"`);
    expect(html).toContain(`href="${base}/produtos?filter=featured"`);
    expect(html).toContain(`href="${base}/produtos?filter=bestSeller"`);
    expect(html).toContain(`href="${base}/produtos?status=published&amp;filter=noImage"`);
    expect(html).toContain(`href="${base}/representantes"`);
    expect(html).toContain(`href="${base}/solicitacoes"`);
    // Valores vindos do servidor, com hint interpolado.
    expect(html).toContain(">700<");
    expect(html).toContain(dashboard.kpis.published.hint.replace("{total}", "737"));
    expect(html).toContain(dashboard.kpis.leads.hint.replace("{days}", "30"));
    // Atalhos
    expect(html).toContain(`href="${base}/produtos?new=1"`);
    expect(html).toContain(`href="${base}/pagina-inicial"`);
    expect(html).toContain(`href="${base}/hero"`);
    expect(html).toContain(`href="/${locale}"`);
    // Solicitações recentes: assunto traduzido, nome e empresa.
    expect(html).toContain(dashboard.recentLeads.subjects.cart);
    expect(html).toContain(dashboard.recentLeads.subjects.call_back);
    expect(html).toContain("João Silva");
    expect(html).toContain("Empresa Ltda");
    // Saúde do catálogo: 9 publicados sem foto -> atalho e sem o "tudo em dia".
    expect(html).toContain(dashboard.health.title);
    expect(html).toContain(dashboard.health.reviewNoPhoto);
    expect(html).not.toContain(dashboard.health.healthy);
    expectNoBrokenText(html);
  });

  it("quem só lê produtos não vê revisão, solicitações nem 'novo produto'", () => {
    const html = render(
      <DashboardSummary
        portal={portal}
        user={{ roles: [], permissions: ["products:read"] }}
        locale={locale}
      />,
      locale,
      seededClient()
    );
    expect(html).toContain(dashboard.kpis.published.label);
    expect(html).not.toContain(dashboard.kpis.reviews.label);
    expect(html).not.toContain(dashboard.kpis.leads.label);
    expect(html).not.toContain(dashboard.recentLeads.title);
    expect(html).not.toContain(`${base}/produtos?new=1`);
    expect(html).not.toContain(`${base}/pagina-inicial`);
    // "Ver o site" é o único atalho que não depende de permissão.
    expect(html).toContain(dashboard.quickActions.viewSite.label);
    expectNoBrokenText(html);
  });

  it("sem nenhuma permissão de leitura mostra o estado vazio", () => {
    const html = render(
      <DashboardSummary portal={portal} user={{ roles: [], permissions: [] }} locale={locale} />,
      locale
    );
    expect(html).toContain(dashboard.emptyState);
    expectNoBrokenText(html);
  });

  it("carregando: mostra esqueletos e nenhum número inventado", () => {
    const html = render(<DashboardSummary portal={portal} user={ADMIN} locale={locale} />, locale);
    expect(html).toContain("MuiSkeleton");
    expect(html).not.toContain(">700<");
    expectNoBrokenText(html);
  });
});

// ---------------------------------------------------------------------------

const product = (overrides: Partial<ProductListItem>): ProductListItem => ({
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  sku: "1122",
  slug: "valvula-de-descarga",
  namePt: "Válvula de Descarga",
  nameEn: null,
  published: true,
  active: true,
  featured: true,
  featuredOrder: 0,
  bestSeller: false,
  updatedAt: "2026-09-29T14:32:00.000Z",
  categories: [
    { id: "c1", namePt: "Hidrossanitários" },
    { id: "c2", namePt: "Reparos" },
  ],
  badges: ["nacional"],
  imageCount: 2,
  siteImageCount: 2,
  coverUrl: "https://img.roco.com.br/products/1122/a.jpg",
  packagings: [
    { packagingType: "peca", unitsPerPack: 1 },
    { packagingType: "blister", unitsPerPack: 12 },
    { packagingType: "caixa", unitsPerPack: 12 },
  ],
  ...overrides,
});

const sampleProducts: ProductListItem[] = [
  product({}),
  product({
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    sku: "2001",
    slug: "joelho-90",
    namePt: "Joelho 90",
    published: false,
    featured: false,
    bestSeller: true,
    imageCount: 0,
    siteImageCount: 0,
    coverUrl: null,
    categories: [],
    badges: [],
    packagings: [],
  }),
];

describe.each(["pt", "en"] as const)("tabela de produtos (%s)", (locale) => {
  const dictionary = PORTALS[locale].products;

  function renderTable(perms: { write: boolean; publish: boolean; remove: boolean }) {
    return render(
      <ProductTable
        dictionary={dictionary}
        locale={locale}
        items={sampleProducts}
        isLoading={false}
        busyIds={new Set()}
        canWrite={perms.write}
        canPublish={perms.publish}
        canDelete={perms.remove}
        canOpenImages={perms.write}
        onEdit={() => {}}
        onOpenImages={() => {}}
        onTogglePublished={() => {}}
        onToggleFeatured={() => {}}
        onToggleBestSeller={() => {}}
        onCopyLink={() => {}}
        onShareWhatsapp={() => {}}
        onDelete={() => {}}
      />,
      locale
    );
  }

  it("editor: miniatura, nome + SKU, categorias, flags acionáveis, publicação e menu", () => {
    const html = renderTable({ write: true, publish: true, remove: true });
    expect(html).toContain("https://img.roco.com.br/products/1122/a.jpg");
    expect(html).toContain("Válvula de Descarga");
    expect(text(html)).toContain(`${dictionary.table.sku} 1122`);
    // TODAS as embalagens, na ordem do servidor — nenhuma "padrão" escondendo as outras.
    const types = dictionary.form.packagingTypes;
    expect(text(html)).toContain(`${types.peca} × 1 · ${types.blister} × 12 · ${types.caixa} × 12`);
    expect(html).toContain("Hidrossanitários");
    expect(html).toContain("+1"); // segunda categoria
    // Flags: estado em aria-pressed, nome estável no aria-label.
    expect(html).toContain(`aria-label="${dictionary.form.fields.featured}: Válvula de Descarga"`);
    expect(html).toContain(`aria-label="${dictionary.form.fields.bestSeller}: Joelho 90"`);
    expect(html).toMatch(/aria-pressed="true"/);
    expect(html).toMatch(/aria-pressed="false"/);
    // Publicado / sem foto
    expect(html).toContain(`aria-label="${dictionary.form.fields.published}: Válvula de Descarga"`);
    expect(html).toContain(dictionary.table.noPhoto);
    // Um menu de ações por linha.
    expect((html.match(new RegExp(`aria-label="${dictionary.actions.more}: `, "g")) ?? []).length).toBe(2);
    expectNoBrokenText(html);
  });

  it("somente leitura: flags e publicação desabilitadas, mas o menu de compartilhar continua", () => {
    const html = renderTable({ write: false, publish: false, remove: false });
    // Nome sem botão de editar (não é link/botão).
    expect(html).not.toContain(dictionary.actions.edit);
    // Flags desabilitadas, sem Tooltip (sem aria-label extra do tooltip).
    const flagButtons = html.match(/<button[^>]*aria-pressed[^>]*>/g) ?? [];
    expect(flagButtons.length).toBe(4);
    expect(flagButtons.every((tag) => tag.includes("disabled"))).toBe(true);
    // O publicado tem menu (ver no site / copiar / WhatsApp); o rascunho não tem nenhuma ação e fica sem botão.
    expect((html.match(new RegExp(`aria-label="${dictionary.actions.more}: `, "g")) ?? []).length).toBe(1);
    expectNoBrokenText(html);
  });

  it("carregando: esqueleto, sem dados", () => {
    const html = render(
      <ProductTable
        dictionary={dictionary}
        locale={locale}
        items={[]}
        isLoading
        busyIds={new Set()}
        canWrite
        canPublish
        canDelete
        canOpenImages
        onEdit={() => {}}
        onOpenImages={() => {}}
        onTogglePublished={() => {}}
        onToggleFeatured={() => {}}
        onToggleBestSeller={() => {}}
        onCopyLink={() => {}}
        onShareWhatsapp={() => {}}
        onDelete={() => {}}
      />,
      locale
    );
    expect(html).toContain("MuiSkeleton");
    expect(html).not.toContain("Válvula de Descarga");
  });
});

describe.each(["pt", "en"] as const)("página de produtos (%s)", (locale) => {
  const portal = PORTALS[locale];
  const dictionary = portal.products;

  function seeded() {
    const client = newQueryClient();
    client.setQueryData(
      [["products", "list"], { input: { page: 1, perPage: 20, published: true, featured: true }, type: "query" }],
      { items: sampleProducts, total: 2, page: 1, perPage: 20 }
    );
    client.setQueryData(
      [["products", "categories", "list"], { type: "query" }],
      [{ id: "c1", namePt: "Hidrossanitários", nameEn: "Plumbing" }]
    );
    return client;
  }

  it("admin: filtros vindos da URL, contagem, botões do topo e paginação da lista", () => {
    const html = render(
      <ProductsPageClient portal={portal} user={ADMIN} locale={locale} />,
      locale,
      seeded()
    );
    expect(html).toContain(dictionary.title);
    expect(html).toContain(dictionary.subtitle);
    expect(html).not.toContain("769");
    // Contagem com plural via dicionário.
    expect(html).toContain(dictionary.count.other.replace("{count}", "2"));
    // Filtros da URL (?status=published&filter=featured): o chip fica pressionado.
    expect(html).toContain(dictionary.filters.featured);
    expect(html).toMatch(new RegExp(`aria-pressed="true"[^>]*>(?:<[^>]+>)*[^<]*(?:<[^>]+>)*${dictionary.filters.featured}`));
    // O select de status mostra o valor da URL (o item "Todos" só existe com o menu aberto);
    // o de categoria mostra "todas" porque nenhuma foi escolhida.
    expect(html).toContain(dictionary.status.published);
    expect(html).toContain(dictionary.filters.categoryAll);
    expect(html).toContain(dictionary.filters.clear);
    // Criação, download em lote e paginação numerada (faixa "1–2" do MUI no idioma do tema).
    expect(html).toContain(dictionary.form.createTitle);
    expect(html).toContain(dictionary.bulkDownload.button);
    expect(html).toContain("MuiTablePagination");
    expect(html).toContain("MuiPagination");
    expect(text(html)).toMatch(/1–2/);
    expectNoBrokenText(html);
  });

  it("representante (só leitura): subtítulo próprio e sem botão de novo produto", () => {
    const html = render(
      <ProductsPageClient portal={portal} user={REPRESENTATIVE} locale={locale} />,
      locale,
      seeded()
    );
    expect(html).toContain(dictionary.subtitleReadOnly);
    expect(html).not.toContain(dictionary.form.createTitle);
    expect(html).not.toContain(dictionary.sync.title);
    // Com `product_images:download` o representante baixa as imagens do filtro.
    expect(html).toContain(dictionary.bulkDownload.button);
    expectNoBrokenText(html);
  });
});

// ---------------------------------------------------------------------------

describe.each(["pt", "en"] as const)("configurações do site (%s)", (locale) => {
  const labels = PORTALS[locale].settings;

  function seeded(socialValue: string) {
    const client = newQueryClient();
    client.setQueryData(
      [["siteSettings", "list"], { type: "query" }],
      [
        { key: "contact.phone", value: "554733352012", type: "string", description: null, updatedAt: "" },
        { key: "contact.email", value: "vendas@roco.com.br", type: "string", description: null, updatedAt: "" },
        { key: "contact.address.matriz", value: "Rua Amsterdam, 853", type: "string", description: null, updatedAt: "" },
        { key: "contact.address.filial", value: "Unidade fabril em Gaspar", type: "string", description: null, updatedAt: "" },
        { key: "social.links", value: socialValue, type: "string", description: null, updatedAt: "" },
        { key: "catalog.pdf-url", value: "/downloads/catalogo-roco-2026.pdf", type: "string", description: null, updatedAt: "" },
      ]
    );
    return client;
  }

  it("quatro blocos, redes em campos separados (nada de JSON cru) e valores carregados", () => {
    const html = render(
      <SettingsPageClient labels={labels} />,
      locale,
      seeded(JSON.stringify({ instagram: "https://instagram.com/roco", whatsapp: "https://wa.me/554733352012" }))
    );
    for (const block of ["contact", "addresses", "social", "catalog"] as const) {
      expect(html).toContain(labels.blocks[block].title);
    }
    for (const field of ["phone", "email", "addressMatriz", "addressFilial", "instagram", "linkedin", "youtube", "whatsapp", "catalogPdf"] as const) {
      expect(html).toContain(labels.fields[field].label);
    }
    expect(html).toContain('value="554733352012"');
    expect(html).toContain('value="https://instagram.com/roco"');
    expect(html).toContain('value="/downloads/catalogo-roco-2026.pdf"');
    // Sem campo de JSON cru.
    expect(html).not.toContain("JSON");
    expect(html).not.toContain(labels.form.errors.storedInvalid);
    // Um botão de salvar por bloco, todos desabilitados (nada foi alterado).
    const saveButtons = html.match(/<button[^>]*type="submit"[^>]*>/g) ?? [];
    expect(saveButtons.length).toBe(4);
    expect(saveButtons.every((tag) => tag.includes("disabled"))).toBe(true);
    expectNoBrokenText(html);
  });

  it("avisa quando o valor salvo das redes sociais está num formato inválido", () => {
    const html = render(<SettingsPageClient labels={labels} />, locale, seeded("isto não é json"));
    expect(html).toContain(labels.form.errors.storedInvalid);
    expectNoBrokenText(html);
  });
});
