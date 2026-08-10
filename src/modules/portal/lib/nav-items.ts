import type { PortalNavItem } from "@/modules/portal/components/portal-shell";
import { can, type PortalPermissionUser } from "./permissions";

type NavLabels = {
  dashboard: string;
  onboarding: string;
  products: string;
  representatives: string;
};

/** Única role que passa pelo fluxo de onboarding (ver `src/db/schema/auth`
 *  seed — time interno nunca recebe esta role). */
const REPRESENTATIVE_ROLE_SLUG = "representative";

/**
 * Monta os itens de navegação do shell conforme a sessão:
 * - `Onboarding` só é exibido para quem tem a role `representative` (é o
 *   único fluxo que a usa — o time interno nunca precisa fazer onboarding).
 * - `Produtos`/`Representantes` conforme a permissão granular
 *   (`products:read` / `representatives:read` — `admin` sempre passa via
 *   `can()`).
 *
 * Item ausente = escondido, não mais "em breve": a partir da onda 2 toda
 * rota do nav tem uma página real (o placeholder `disabled`/`comingSoon` do
 * shell continua existindo para uma eventual página futura, mas não é mais
 * usado por nenhum destes 3 itens).
 */
export function buildPortalNavItems(
  basePath: string,
  labels: NavLabels,
  user: PortalPermissionUser
): PortalNavItem[] {
  const items: PortalNavItem[] = [
    { key: "dashboard", label: labels.dashboard, href: basePath },
  ];

  if (user?.roles?.includes(REPRESENTATIVE_ROLE_SLUG)) {
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

  return items;
}
