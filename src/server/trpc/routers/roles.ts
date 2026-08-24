import "server-only";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { permissions, rolePermissions, roles, userRoles, users } from "@/db/schema";
import { writeAuditLog } from "@/server/lib/audit";
import {
  canDeleteRole,
  canEditRolePermissions,
  canGrantRole,
  wouldRemoveLastAdmin,
  wouldSelfLockout,
} from "@/server/lib/roles-guards";
import { permissionProcedure, router } from "../init";

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;

/** Perfis/permissões: única permissão-gate para a tela inteira (perfis, matriz, usuários). */
const rolesManageProcedure = permissionProcedure("roles", "manage");

export const rolesRouter = router({
  /** Todos os perfis, com permissões (slugs "resource:action") e contagem de usuários. */
  listRoles: rolesManageProcedure.query(async ({ ctx }) => {
    const allRoles = await ctx.db.select().from(roles).orderBy(asc(roles.name));
    if (allRoles.length === 0) {
      return [];
    }
    const roleIds = allRoles.map((role) => role.id);

    const [permissionRows, userCountRows] = await Promise.all([
      ctx.db
        .select({
          roleId: rolePermissions.roleId,
          resource: permissions.resource,
          action: permissions.action,
        })
        .from(rolePermissions)
        .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
        .where(inArray(rolePermissions.roleId, roleIds)),
      ctx.db
        .select({ roleId: userRoles.roleId, total: sql<number>`count(*)::int` })
        .from(userRoles)
        .where(inArray(userRoles.roleId, roleIds))
        .groupBy(userRoles.roleId),
    ]);

    const permissionSlugsByRole = new Map<string, string[]>();
    for (const row of permissionRows) {
      const list = permissionSlugsByRole.get(row.roleId) ?? [];
      list.push(`${row.resource}:${row.action}`);
      permissionSlugsByRole.set(row.roleId, list);
    }

    const userCountByRole = new Map<string, number>();
    for (const row of userCountRows) {
      userCountByRole.set(row.roleId, row.total);
    }

    return allRoles.map((role) => ({
      ...role,
      permissionSlugs: permissionSlugsByRole.get(role.id) ?? [],
      userCount: userCountByRole.get(role.id) ?? 0,
    }));
  }),

  /** Catálogo estático de permissões (referência para a UI montar a matriz por `resource`). */
  listPermissionsCatalog: rolesManageProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({ id: permissions.id, resource: permissions.resource, action: permissions.action })
      .from(permissions)
      .orderBy(asc(permissions.resource), asc(permissions.action));
  }),

  /** Cria um perfil customizado (`isSystem` sempre `false`; slug imutável depois de criado). */
  createRole: rolesManageProcedure
    .input(
      z.object({
        slug: z
          .string()
          .trim()
          .min(2)
          .max(50)
          .regex(/^[a-z0-9_]+$/, "Slug deve usar apenas letras minúsculas, números e underscore."),
        name: z.string().trim().min(1).max(100),
        description: z.string().trim().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.slug, input.slug))
        .limit(1);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "Slug já em uso." });
      }

      const [row] = await ctx.db
        .insert(roles)
        .values({
          slug: input.slug,
          name: input.name,
          description: input.description ?? null,
          isSystem: false,
        })
        .returning();
      if (!row) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao criar perfil." });
      }

      await writeAuditLog(ctx.db, ctx.session, {
        action: "roles.create",
        resource: "roles",
        resourceId: row.id,
        metadata: { slug: row.slug },
      });
      return { ...row, permissionSlugs: [] as string[], userCount: 0 };
    }),

  /** Edita nome/descrição — o `slug` nunca é aceito no input (imutável por design). */
  updateRoleMeta: rolesManageProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(100),
        description: z.string().trim().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db.select({ id: roles.id }).from(roles).where(eq(roles.id, input.id)).limit(1);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Perfil não encontrado." });
      }

      const [row] = await ctx.db
        .update(roles)
        .set({ name: input.name, description: input.description ?? null })
        .where(eq(roles.id, input.id))
        .returning();
      if (!row) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao atualizar perfil." });
      }

      await writeAuditLog(ctx.db, ctx.session, {
        action: "roles.update_meta",
        resource: "roles",
        resourceId: input.id,
      });
      return row;
    }),

  /** Exclui um perfil customizado sem usuários atribuídos (guarda `canDeleteRole`). */
  deleteRole: rolesManageProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [role] = await ctx.db.select().from(roles).where(eq(roles.id, input.id)).limit(1);
      if (!role) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Perfil não encontrado." });
      }

      const [countRow] = await ctx.db
        .select({ total: sql<number>`count(*)::int` })
        .from(userRoles)
        .where(eq(userRoles.roleId, input.id));
      const assignedUserCount = countRow?.total ?? 0;

      const guard = canDeleteRole({ isSystem: role.isSystem, assignedUserCount });
      if (!guard.ok) {
        const message =
          guard.reason === "system_role"
            ? "Perfis de sistema não podem ser excluídos."
            : "Este perfil tem usuários atribuídos — remova-os antes de excluir.";
        throw new TRPCError({ code: "PRECONDITION_FAILED", message });
      }

      // `assignedUserCount === 0` já garantido pela guarda acima — o cascade
      // de `role_permissions`/`user_roles` não deixa órfãos mesmo assim.
      await ctx.db.delete(roles).where(eq(roles.id, input.id));

      await writeAuditLog(ctx.db, ctx.session, {
        action: "roles.delete",
        resource: "roles",
        resourceId: input.id,
        metadata: { slug: role.slug },
      });
      return { ok: true as const };
    }),

  /**
   * Substitui a matriz de permissões de um perfil (exceto `admin`, travado
   * — `canEditRolePermissions`). Bloqueia autolockout: se o ator não é
   * admin, edita um dos SEUS PRÓPRIOS perfis, e a nova matriz não incluiria
   * mais `roles:manage`, a mutação é rejeitada (`wouldSelfLockout`).
   */
  updateRolePermissions: rolesManageProcedure
    .input(
      z.object({
        roleId: z.string().uuid(),
        permissionIds: z.array(z.string().uuid()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [role] = await ctx.db.select().from(roles).where(eq(roles.id, input.roleId)).limit(1);
      if (!role) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Perfil não encontrado." });
      }

      const editGuard = canEditRolePermissions({ slug: role.slug });
      if (!editGuard.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "O perfil Administrador tem acesso total implícito e não é editável.",
        });
      }

      const catalog =
        input.permissionIds.length > 0
          ? await ctx.db
              .select({ id: permissions.id, resource: permissions.resource, action: permissions.action })
              .from(permissions)
              .where(inArray(permissions.id, input.permissionIds))
          : [];
      const newPermissionSlugs = catalog.map((permission) => `${permission.resource}:${permission.action}`);

      const actorRoleRows = await ctx.db
        .select({ roleId: userRoles.roleId })
        .from(userRoles)
        .where(eq(userRoles.userId, ctx.session.user.id));
      const actorRoleIds = actorRoleRows.map((row) => row.roleId);

      const lockout = wouldSelfLockout({
        actorRoleSlugs: ctx.session.user.roles ?? [],
        actorRoleIds,
        editingRoleId: input.roleId,
        newPermissionSlugs,
      });
      if (lockout) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Esta alteração removeria seu próprio acesso a esta tela.",
        });
      }

      await ctx.db.transaction(async (tx) => {
        await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, input.roleId));
        if (catalog.length > 0) {
          await tx
            .insert(rolePermissions)
            .values(catalog.map((permission) => ({ roleId: input.roleId, permissionId: permission.id })));
        }
      });

      await writeAuditLog(ctx.db, ctx.session, {
        action: "roles.update_permissions",
        resource: "roles",
        resourceId: input.roleId,
        metadata: { roleId: input.roleId, permissionSlugs: newPermissionSlugs },
      });

      return { ok: true as const, permissionSlugs: newPermissionSlugs };
    }),

  /** Usuários do portal com busca (nome/e-mail) + paginação + perfis atribuídos. */
  listUsers: rolesManageProcedure
    .input(
      z.object({
        search: z.string().trim().min(1).max(120).optional(),
        page: z.number().int().min(1).default(DEFAULT_PAGE),
        perPage: z.number().int().min(1).max(MAX_PER_PAGE).default(DEFAULT_PER_PAGE),
      })
    )
    .query(async ({ ctx, input }) => {
      const { search, page, perPage } = input;

      const conditions = [];
      if (search) {
        const like = `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
        conditions.push(or(ilike(users.name, like), ilike(users.email, like))!);
      }
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [rows, [countRow]] = await Promise.all([
        ctx.db
          .select({ id: users.id, name: users.name, email: users.email, active: users.active })
          .from(users)
          .where(whereClause)
          .orderBy(asc(users.name))
          .limit(perPage)
          .offset((page - 1) * perPage),
        ctx.db.select({ total: sql<number>`count(*)::int` }).from(users).where(whereClause),
      ]);

      const total = countRow?.total ?? 0;
      if (rows.length === 0) {
        return { items: [], total, page, perPage };
      }

      const roleRows = await ctx.db
        .select({ userId: userRoles.userId, id: roles.id, slug: roles.slug, name: roles.name })
        .from(userRoles)
        .innerJoin(roles, eq(roles.id, userRoles.roleId))
        .where(
          inArray(
            userRoles.userId,
            rows.map((row) => row.id)
          )
        );

      const rolesByUser = new Map<string, { id: string; slug: string; name: string }[]>();
      for (const row of roleRows) {
        const list = rolesByUser.get(row.userId) ?? [];
        list.push({ id: row.id, slug: row.slug, name: row.name });
        rolesByUser.set(row.userId, list);
      }

      const items = rows.map((row) => ({ ...row, roles: rolesByUser.get(row.id) ?? [] }));
      return { items, total, page, perPage };
    }),

  /**
   * Concede um perfil a um usuário. Anti-escalonamento (`canGrantRole`):
   * conceder o perfil "admin" exige que o próprio ator já seja admin.
   */
  assignUserRole: rolesManageProcedure
    .input(
      z.object({
        userId: z.string().trim().min(1),
        roleId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [role] = await ctx.db.select().from(roles).where(eq(roles.id, input.roleId)).limit(1);
      if (!role) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Perfil não encontrado." });
      }

      const grantGuard = canGrantRole({
        actorRoleSlugs: ctx.session.user.roles ?? [],
        targetRoleSlug: role.slug,
      });
      if (!grantGuard.ok) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Só um administrador pode conceder o perfil Administrador.",
        });
      }

      await ctx.db.insert(userRoles).values({ userId: input.userId, roleId: input.roleId }).onConflictDoNothing();

      await writeAuditLog(ctx.db, ctx.session, {
        action: "user_roles.assign",
        resource: "roles",
        resourceId: input.roleId,
        metadata: { userId: input.userId, roleSlug: role.slug },
      });
      return { ok: true as const };
    }),

  /**
   * Remove um perfil de um usuário. Bloqueia o último admin
   * (`wouldRemoveLastAdmin`): remover "admin" não pode zerar a contagem de
   * administradores ATIVOS do sistema.
   */
  unassignUserRole: rolesManageProcedure
    .input(
      z.object({
        userId: z.string().trim().min(1),
        roleId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [role] = await ctx.db.select().from(roles).where(eq(roles.id, input.roleId)).limit(1);
      if (!role) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Perfil não encontrado." });
      }

      if (role.slug === "admin") {
        const [countRow] = await ctx.db
          .select({ total: sql<number>`count(distinct ${userRoles.userId})::int` })
          .from(userRoles)
          .innerJoin(roles, eq(roles.id, userRoles.roleId))
          .innerJoin(users, eq(users.id, userRoles.userId))
          .where(and(eq(roles.slug, "admin"), eq(users.active, true)));
        const currentActiveAdminCount = countRow?.total ?? 0;

        if (wouldRemoveLastAdmin({ targetRoleSlug: role.slug, currentActiveAdminCount })) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Não é possível remover o último administrador do sistema.",
          });
        }
      }

      await ctx.db
        .delete(userRoles)
        .where(and(eq(userRoles.userId, input.userId), eq(userRoles.roleId, input.roleId)));

      await writeAuditLog(ctx.db, ctx.session, {
        action: "user_roles.unassign",
        resource: "roles",
        resourceId: input.roleId,
        metadata: { userId: input.userId, roleSlug: role.slug },
      });
      return { ok: true as const };
    }),
});
