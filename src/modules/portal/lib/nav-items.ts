import type { PortalNavItem } from "@/modules/portal/components/portal-shell";
import {
  ADMIN_ROLE_SLUG,
  REPRESENTATIVE_ROLE_SLUG,
  can,
  type PortalPermissionUser,
} from "./permissions";

type NavLabels = {
  dashboard: string;
  onboarding: string;
  products: string;
  representatives: string;
  welcome: string;
  hero: string;
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
 * - `Produtos`/`Representantes` conforme a permissão granular
 *   (`products:read` / `representatives:read` — `admin` sempre passa via
 *   `can()`).
 *
 * Item ausente = escondido, não mais "em breve": a partir da onda 2 toda
 * rota do nav tem uma página real (o placeholder `disabled`/`comingSoon` do
 * shell continua existindo para uma eventual página futura, mas não é mais
 * usado por nenhum destes itens).
 */
export function buildPortalNavItems(
  basePath: string,
  labels: NavLabels,
  user: PortalPermissionUser
): PortalNavItem[] {
  const items: PortalNavItem[] = [
    { key: "dashboard", label: labels.dashboard, href: basePath },
  ];

  const isRepresentative = user?.roles?.includes(REPRESENTATIVE_ROLE_SLUG) ?? false;

  if (isRepresentative || user?.roles?.includes(ADMIN_ROLE_SLUG)) {
    items.push({
      key: "welcome",
      label: labels.welcome,
      href: `${basePath}/boas-vindas`,
    });
  }

  if (isRepresentative) {
    items.push({
      key: "onboarding",
      label: labels.onboarding,
      href: `${basePath}/onboarding`,
    });
  }

  if (can(user, "products", "read")) {
    items.push({
      key: "products",
      label: labels.products,
      href: `${basePath}/produtos`,
    });
  }

  if (can(user, "representatives", "read")) {
    items.push({
      key: "representatives",
      label: labels.representatives,
      href: `${basePath}/representantes`,
    });
  }

  if (can(user, "hero_slides", "read")) {
    items.push({
      key: "hero",
      label: labels.hero,
      href: `${basePath}/hero`,
    });
  }

  // Gate por `materials:create` (não `materials:read`): o representante
  // tem só `read` para o feed somente-leitura embutido em
  // `/portal/boas-vindas` (`WelcomeMaterialsFeed`) — nunca deveria ver o
  // item de nav do CRUD administrativo. Ver decisionLog 2026-08-24.
  if (can(user, "materials", "create")) {
    items.push({
      key: "materials",
      label: labels.materials,
      href: `${basePath}/materiais`,
    });
  }

  if (can(user, "roles", "manage")) {
    items.push({
      key: "roles",
      label: labels.roles,
      href: `${basePath}/perfis`,
    });
  }

  // Configurações do site: acessível a qualquer usuário com role `admin`
  // (equivalente a `users:manage` — não há permissão granular separada).
  if (user?.roles?.includes(ADMIN_ROLE_SLUG)) {
    items.push({
      key: "settings",
      label: labels.settings,
      href: `${basePath}/configuracoes`,
    });
  }

  return items;
}
