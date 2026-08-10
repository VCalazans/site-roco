/**
 * RBAC granular: Role -> RolePermission -> Permission(resource, action).
 * Ver decisionLog 2026-08-09 ("RBAC granular (resource + action)").
 */
import { boolean, pgTable, primaryKey, text, unique, uuid, varchar } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const roles = pgTable("roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  /** Roles seed (admin, sales_manager, representative, viewer) — não editáveis via UI. */
  isSystem: boolean("is_system").notNull().default(false),
});

export const permissions = pgTable(
  "permissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    resource: varchar("resource", { length: 50 }).notNull(),
    action: varchar("action", { length: 50 }).notNull(),
  },
  (table) => [
    unique("permissions_resource_action_unique").on(table.resource, table.action),
  ]
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })]
);

export const userRoles = pgTable(
  "user_roles",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.roleId] })]
);
