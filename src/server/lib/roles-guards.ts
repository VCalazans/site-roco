/**
 * Guardas de segurança do RBAC dinâmico (`/{locale}/portal/perfis`) — 100%
 * puras (sem `db`/`ctx`), montadas a partir de parâmetros primitivos que o
 * router `roles.ts` resolve via consultas antes de decidir se bloqueia uma
 * mutação. Ver decisionLog 2026-08-24 ("Perfis e permissões dinâmicos").
 */

/**
 * Bloqueia a exclusão de: (a) qualquer perfil de SISTEMA (`admin`,
 * `sales_manager`, `representative`, `viewer` — os 4 slugs seed, cujos
 * literais são referenciados fora da tabela `permissions` em vários pontos
 * do código); (b) qualquer perfil (de sistema ou customizado) que ainda
 * tenha usuários atribuídos — evita apagar um perfil "debaixo" de quem o usa.
 */
export function canDeleteRole(params: {
  isSystem: boolean;
  assignedUserCount: number;
}): { ok: true } | { ok: false; reason: "system_role" | "has_users" } {
  if (params.isSystem) return { ok: false, reason: "system_role" };
  if (params.assignedUserCount > 0) return { ok: false, reason: "has_users" };
  return { ok: true };
}

/**
 * Bloqueia editar a matriz de permissões do perfil `admin`: `admin` tem
 * bypass total hardcoded em `hasPermission()` (`src/core/auth/rbac.ts`) —
 * editar `role_permissions` desse perfil não mudaria nada no sistema, então
 * a UI nem oferece a edição (evita a falsa impressão de que "destravar"
 * ou "travar" o admin por aqui teria efeito real).
 */
export function canEditRolePermissions(params: {
  slug: string;
}): { ok: true } | { ok: false; reason: "admin_role_locked" } {
  return params.slug === "admin"
    ? { ok: false, reason: "admin_role_locked" }
    : { ok: true };
}

/**
 * Autolockout: se quem está editando NÃO é admin, e o perfil que está
 * editando é um dos perfis que ele mesmo possui, e a nova matriz de
 * permissões não incluiria mais "roles:manage" nesse perfil, a edição
 * deixaria o próprio ator sem acesso a esta tela.
 */
export function wouldSelfLockout(params: {
  actorRoleSlugs: string[];
  actorRoleIds: string[];
  editingRoleId: string;
  newPermissionSlugs: string[]; // formato "resource:action"
}): boolean {
  const actorIsAdmin = params.actorRoleSlugs.includes("admin");
  if (actorIsAdmin) return false;
  if (!params.actorRoleIds.includes(params.editingRoleId)) return false;
  return !params.newPermissionSlugs.includes("roles:manage");
}

/**
 * Bloqueia remover a role "admin" de um usuário se isso zerar a contagem
 * de admins ATIVOS — evita o cenário clássico "portal RBAC que ninguém
 * mais consegue administrar" (nenhum usuário ativo sobra com `roles:manage`
 * irrestrito para desfazer o próprio engano).
 */
export function wouldRemoveLastAdmin(params: {
  targetRoleSlug: string;
  currentActiveAdminCount: number;
}): boolean {
  if (params.targetRoleSlug !== "admin") return false;
  return params.currentActiveAdminCount <= 1;
}

/**
 * Anti-escalonamento de privilégio: só um ator que já É admin pode
 * CONCEDER a role "admin" a alguém. Não basta ter a permissão genérica
 * `roles:manage` delegada — sem esta guarda, um perfil customizado com
 * `roles:manage` (mas sem ser admin) poderia criar novos admins por conta
 * própria.
 */
export function canGrantRole(params: {
  actorRoleSlugs: string[];
  targetRoleSlug: string;
}): { ok: true } | { ok: false; reason: "requires_admin_actor" } {
  if (params.targetRoleSlug !== "admin") return { ok: true };
  return params.actorRoleSlugs.includes("admin")
    ? { ok: true }
    : { ok: false, reason: "requires_admin_actor" };
}
