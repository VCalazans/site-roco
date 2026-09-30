import {
  ADMIN_ROLE_SLUG,
  REPRESENTATIVE_ROLE_SLUG,
  can,
  isRepresentativeOnly,
  type PortalPermissionUser,
} from "./permissions";

export type PortalNavKey =
  | "dashboard"
  | "welcome"
  | "onboarding"
  | "products"
  | "leads"
  | "representatives"
  | "homeContent"
  | "hero"
  | "materials"
  | "settings"
  | "roles";

/**
 * Grupos da sidebar (spec 001). A ordem dos grupos é fixa e vem de
 * `PORTAL_NAV_GROUP_ORDER`; a ordem dos itens dentro de cada um é a de
 * `buildPortalNavItems`.
 */
export type PortalNavGroupKey = "overview" | "catalog" | "relationship" | "site" | "admin";

export const PORTAL_NAV_GROUP_ORDER: readonly PortalNavGroupKey[] = [
  "overview",
  "catalog",
  "relationship",
  "site",
  "admin",
];

export type PortalNavItem = {
  key: PortalNavKey;
  label: string;
  href: string;
  group: PortalNavGroupKey;
  /** Item "em breve" — desabilitado no drawer, mostra `comingSoonLabel`. */
  disabled?: boolean;
};

export type PortalNavGroup = {
  key: PortalNavGroupKey;
  items: PortalNavItem[];
};

type NavLabels = {
  dashboard: string;
  onboarding: string;
  products: string;
  representatives: string;
  welcome: string;
  hero: string;
  homeContent: string;
  leads: string;
  /** Sem chave própria em `portal.shell.nav` — os call-sites passam
   *  `portal.materials.title` (reaproveitado como rótulo de nav, mesmo
   *  padrão de reuso já usado no projeto; ver decisionLog 2026-08-24). */
  materials: string;
  /** Idem, reaproveita `portal.roles.title`. */
  roles: string;
  /** Idem, reaproveita `portal.settings.title`. */
  settings: string;
};

/**
 * Monta os itens de navegação do shell conforme a sessão:
 * - `Boas-vindas` para quem tem a role `representative` OU `admin` (o
 *   representante tem aqui sua "home"; o admin precisa enxergar/testar a
 *   página) — não usa `can()`, é uma checagem de role, não de permissão
 *   granular (ver `isRepresentativeOnly`/decisão em `permissions.ts`).
 * - `Onboarding` só é exibido para quem tem a role `representative` (é o
 *   único fluxo que a usa — o time interno nunca precisa fazer onboarding).
 * - Demais itens conforme a permissão granular (`can()` — `admin` sempre passa).
 *
 * Item ausente = escondido, não mais "em breve": a partir da onda 2 toda
 * rota do nav tem uma página real (o placeholder `disabled`/`comingSoon` do
 * shell continua existindo para uma eventual página futura, mas não é mais
 * usado por nenhum destes itens).
 *
 * O array sai JÁ na ordem de exibição (grupo por grupo), então quem só
 * precisa da lista plana (testes, breadcrumbs) não depende de `groupPortalNavItems`.
 */
export function buildPortalNavItems(
  basePath: string,
  labels: NavLabels,
  user: PortalPermissionUser
): PortalNavItem[] {
  const items: PortalNavItem[] = [];
  const isRepresentative = user?.roles?.includes(REPRESENTATIVE_ROLE_SLUG) ?? false;
  const isAdmin = user?.roles?.includes(ADMIN_ROLE_SLUG) ?? false;

  // Visão geral. O representante "puro" não vê "Painel": `/portal` o
  // redireciona para as boas-vindas, então o item seria uma segunda porta
  // para a mesma página (revisão 2026-09-30).
  if (!isRepresentativeOnly(user)) {
    items.push({
      key: "dashboard",
      label: labels.dashboard,
      href: basePath,
      group: "overview",
    });
  }

  if (isRepresentative || isAdmin) {
    items.push({
      key: "welcome",
      label: labels.welcome,
      href: `${basePath}/boas-vindas`,
      group: "overview",
    });
  }

  // Materiais para quem só LÊ (o representante): a biblioteca por setor em
  // /portal/materiais, logo abaixo das boas-vindas. Quem gerencia vê o mesmo
  // endereço como CRUD, no grupo "Site" (mais abaixo).
  if (!can(user, "materials", "create") && can(user, "materials", "read")) {
    items.push({
      key: "materials",
      label: labels.materials,
      href: `${basePath}/materiais`,
      group: "overview",
    });
  }

  if (isRepresentative) {
    items.push({
      key: "onboarding",
      label: labels.onboarding,
      href: `${basePath}/onboarding`,
      group: "overview",
    });
  }

  // Catálogo
  if (can(user, "products", "read")) {
    items.push({
      key: "products",
      label: labels.products,
      href: `${basePath}/produtos`,
      group: "catalog",
    });
  }

  // Relacionamento
  if (can(user, "leads", "read")) {
    items.push({
      key: "leads",
      label: labels.leads,
      href: `${basePath}/solicitacoes`,
      group: "relationship",
    });
  }

  if (can(user, "representatives", "read")) {
    items.push({
      key: "representatives",
      label: labels.representatives,
      href: `${basePath}/representantes`,
      group: "relationship",
    });
  }

  // Site
  if (can(user, "home_content", "read")) {
    items.push({
      key: "homeContent",
      label: labels.homeContent,
      href: `${basePath}/pagina-inicial`,
      group: "site",
    });
  }

  if (can(user, "hero_slides", "read")) {
    items.push({
      key: "hero",
      label: labels.hero,
      href: `${basePath}/hero`,
      group: "site",
    });
  }

  // Gestão de materiais (`materials:create`). Quem só lê recebe o item no
  // grupo "Visão geral" (biblioteca) — ver acima. Ver decisionLog 2026-08-24.
  if (can(user, "materials", "create")) {
    items.push({
      key: "materials",
      label: labels.materials,
      href: `${basePath}/materiais`,
      group: "site",
    });
  }

  // Configurações do site: acessível a qualquer usuário com role `admin`
  // (equivalente a `users:manage` — não há permissão granular separada).
  if (isAdmin) {
    items.push({
      key: "settings",
      label: labels.settings,
      href: `${basePath}/configuracoes`,
      group: "site",
    });
  }

  // Administração
  if (can(user, "roles", "manage")) {
    items.push({
      key: "roles",
      label: labels.roles,
      href: `${basePath}/perfis`,
      group: "admin",
    });
  }

  return items;
}

/**
 * Agrupa os itens na ordem fixa dos grupos e descarta os grupos vazios
 * (um representante, por exemplo, nunca vê "Site" nem "Administração" — um
 * título de grupo sem itens embaixo seria ruído).
 */
export function groupPortalNavItems(items: PortalNavItem[]): PortalNavGroup[] {
  return PORTAL_NAV_GROUP_ORDER.map((key) => ({
    key,
    items: items.filter((item) => item.group === key),
  })).filter((group) => group.items.length > 0);
}

function stripTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

/**
 * Item ativo da sidebar. O painel (`dashboard`) só casa por igualdade exata:
 * o `href` dele (`/pt/portal`) é prefixo de TODAS as outras rotas do portal, e
 * um `startsWith` o deixaria sempre marcado. Para os demais vale igualdade ou
 * "é uma subrota" (`href + "/"`) — o `+ "/"` evita que `/portal/produtos`
 * case com um hipotético `/portal/produtos-arquivados`.
 */
export function isPortalNavItemActive(
  pathname: string | null | undefined,
  item: Pick<PortalNavItem, "key" | "href">
): boolean {
  if (!pathname) return false;
  const current = stripTrailingSlash(pathname);
  const href = stripTrailingSlash(item.href);
  if (item.key === "dashboard") return current === href;
  return current === href || current.startsWith(`${href}/`);
}
