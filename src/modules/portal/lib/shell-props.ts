import "server-only";
import type { Session } from "next-auth";
import type { ComponentProps } from "react";
import type { PortalShell } from "@/modules/portal/components/portal-shell";
import { buildPortalNavItems } from "@/modules/portal/lib/nav-items";
import { logoutAction } from "@/modules/portal/lib/logout-action";
import { can } from "@/modules/portal/lib/permissions";
import { getPortalDictionary } from "@/modules/portal/lib/types";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

export type PortalShellProps = Omit<ComponentProps<typeof PortalShell>, "children">;

/**
 * Props do `PortalShell` montadas num lugar só (spec 001).
 *
 * Antes, cada `page.tsx` do portal repetia o mesmo bloco de ~20 linhas
 * (nav por permissão, rótulos do shell, menu do usuário, logout). Qualquer
 * item novo de nav ou rótulo novo do shell exigia editar TODAS as páginas —
 * e bastava esquecer uma para o menu divergir entre telas. Toda página do
 * portal passa a fazer só:
 *
 *   <PortalShell {...buildPortalShellProps({ locale, dictionary, session })}>
 *
 * O shell recebe o `portal.shell` inteiro (`labels`) em vez de uma prop por
 * rótulo: um texto novo do cabeçalho/sidebar passa a exigir só a chave no
 * dicionário + o tipo, sem mexer em nenhuma página.
 */
export function buildPortalShellProps({
  locale,
  dictionary,
  session,
}: {
  locale: Locale;
  dictionary: Dictionary;
  session: Session;
}): PortalShellProps {
  const portal = getPortalDictionary(dictionary);
  const { navigation } = dictionary;
  const basePath = `/${locale}/portal`;
  const { user } = session;

  return {
    locale,
    labels: portal.shell,
    logoAlt: navigation.brand,
    menuLabels: { open: navigation.menu, close: navigation.close },
    navItems: buildPortalNavItems(
      basePath,
      {
        ...portal.shell.nav,
        materials: portal.materials.title,
        roles: portal.roles.title,
        settings: portal.settings.title,
      },
      user
    ),
    // A busca da sidebar leva para `/portal/produtos`, que exige `products:read`
    // — quem não tem a permissão nem vê o campo (o gate real é da página).
    productSearchHref: can(user, "products", "read") ? `${basePath}/produtos` : undefined,
    // Só o que o shell usa: roles/permissions da sessão não precisam viajar
    // para o client component.
    user: { name: user.name, email: user.email, image: user.image },
    // Sai para o login NO MESMO idioma (antes ia para `/portal/login` sem
    // locale e dependia do redirect do proxy).
    logoutAction: logoutAction.bind(null, locale),
  };
}
