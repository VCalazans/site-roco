/**
 * Checagem de permissão no client (gate de UI — esconder/desabilitar ações
 * de escrita). Espelha `hasPermission` de `src/core/auth/rbac.ts` (que é
 * `server-only` e não pode ser importado em Client Components), mas não é
 * uma camada de segurança por si só: o servidor (tRPC `permissionProcedure`)
 * é quem de fato barra a operação. Aqui o objetivo é só UX (não mostrar um
 * botão "Publicar" para quem não pode publicar).
 */
export const ADMIN_ROLE_SLUG = "admin";

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
