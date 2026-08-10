/**
 * Checagem de permissão no client (gate de UI — esconder/desabilitar ações
 * de escrita). Espelha `hasPermission` de `src/core/auth/rbac.ts` (que é
 * `server-only` e não pode ser importado em Client Components), mas não é
 * uma camada de segurança por si só: o servidor (tRPC `permissionProcedure`)
 * é quem de fato barra a operação. Aqui o objetivo é só UX (não mostrar um
 * botão "Publicar" para quem não pode publicar).
 */
export const ADMIN_ROLE_SLUG = "admin";

/** Única role que passa pelo fluxo de onboarding (ver seed em `src/db/seed.ts`
 *  — time interno nunca recebe esta role). Espelhado aqui (fonte única) e
 *  reexportado para `nav-items.ts`, o dashboard e a página de boas-vindas. */
export const REPRESENTATIVE_ROLE_SLUG = "representative";

/** Roles do time interno (`src/db/seed.ts`) — quem tem qualquer uma destas
 *  NÃO é tratado como "representante puro" (ver `isRepresentativeOnly`),
 *  mesmo que também tenha `representative` acumulada. */
export const STAFF_ROLE_SLUGS = ["admin", "sales_manager", "viewer"];

export type PortalPermissionUser =
  | {
      roles?: string[] | null;
      permissions?: string[] | null;
    }
  | null
  | undefined;

/**
 * `can(user, resource, action)` — `user` é o objeto com `roles`/`permissions`
 * já expostos pela sessão (`session.user`, ver `src/core/auth/types.d.ts`).
 * Usuários com a role `admin` sempre passam, independentemente da lista de
 * permissões carregada (mesmo comportamento do `rbac.ts` do server).
 */
export function can(
  user: PortalPermissionUser,
  resource: string,
  action: string
): boolean {
  if (!user) {
    return false;
  }
  if (user.roles?.includes(ADMIN_ROLE_SLUG)) {
    return true;
  }
  return user.permissions?.includes(`${resource}:${action}`) ?? false;
}

/**
 * `true` quando a sessão tem a role `representative` e NENHUMA role de time
 * interno (`STAFF_ROLE_SLUGS`) — usado para decidir se `/portal` (dashboard)
 * redireciona para `/portal/boas-vindas` (a "home" do representante) e para
 * a visibilidade do item de nav `welcome`. Propositalmente NÃO usa `can()`
 * (permissão granular) — a régua aqui é a role em si, não uma permissão
 * derivada dela.
 */
export function isRepresentativeOnly(user: PortalPermissionUser): boolean {
  if (!user?.roles?.includes(REPRESENTATIVE_ROLE_SLUG)) {
    return false;
  }
  return !user.roles.some((role) => STAFF_ROLE_SLUGS.includes(role));
}
