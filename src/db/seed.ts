/**
 * Seed idempotente de roles/permissions (RBAC) do portal.
 *
 * Roda FORA do bundler do Next.js — por isso importa o schema por caminho
 * relativo (`./schema/rbac`), nunca `@/db` (que é `server-only` e lança um
 * erro ao ser importado fora do resolvedor de módulos do Next/React Server
 * Components). Cria seu próprio client Drizzle/pg efêmero.
 *
 * Uso:
 *   npm run db:seed
 *   (equivalente a `node --experimental-strip-types src/db/seed.ts`)
 *
 * Requer Node 22.6+ (o runtime de produção é `node:22-alpine`, ver
 * Dockerfile). Em Node < 22 local, use uma ferramenta de execução de TS
 * (ex.: `tsx`) — não instalada neste projeto por padrão.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { permissions, roles, rolePermissions } from "./schema/rbac";

type PermissionSeed = { resource: string; action: string };

/**
 * Catálogo de permissões. `onboarding:*` foi adicionado além do catálogo
 * original (products, product_images, representatives, categories, sync,
 * users, audit) porque o papel `representative` precisa de permissões
 * próprias para o fluxo de auto-onboarding (ver decisionLog 2026-08-09).
 */
const PERMISSIONS: PermissionSeed[] = [
  { resource: "products", action: "create" },
  { resource: "products", action: "read" },
  { resource: "products", action: "update" },
  { resource: "products", action: "delete" },
  { resource: "products", action: "publish" },
  { resource: "product_images", action: "create" },
  { resource: "product_images", action: "delete" },
  { resource: "representatives", action: "read" },
  { resource: "representatives", action: "review" },
  { resource: "representatives", action: "update" },
  { resource: "categories", action: "manage" },
  { resource: "sync", action: "trigger" },
  { resource: "sync", action: "read" },
  { resource: "users", action: "manage" },
  { resource: "audit", action: "read" },
  { resource: "onboarding", action: "create" },
  { resource: "onboarding", action: "read" },
  { resource: "onboarding", action: "update" },
];

const ROLES: { slug: string; name: string; description: string; isSystem: boolean }[] = [
  { slug: "admin", name: "Administrador", description: "Acesso total ao portal.", isSystem: true },
  {
    slug: "sales_manager",
    name: "Gerente comercial",
    description: "Gestão de produtos e revisão de representantes.",
    isSystem: true,
  },
  {
    slug: "representative",
    name: "Representante",
    description: "Onboarding e consulta de produtos.",
    isSystem: true,
  },
  {
    slug: "viewer",
    name: "Visualizador",
    description: "Consulta de produtos, sem edição.",
    isSystem: true,
  },
];

/** `"*"` = todas as permissões do catálogo acima. */
const ROLE_PERMISSIONS: Record<string, PermissionSeed[] | "*"> = {
  admin: "*",
  sales_manager: [
    { resource: "products", action: "create" },
    { resource: "products", action: "read" },
    { resource: "products", action: "update" },
    { resource: "products", action: "delete" },
    { resource: "products", action: "publish" },
    { resource: "representatives", action: "read" },
    { resource: "representatives", action: "review" },
  ],
  representative: [
    { resource: "onboarding", action: "create" },
    { resource: "onboarding", action: "read" },
    { resource: "onboarding", action: "update" },
    { resource: "products", action: "read" },
  ],
  viewer: [{ resource: "products", action: "read" }],
};

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL não configurada.");
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  try {
    console.log("[seed] Upsert de permissions...");
    for (const permission of PERMISSIONS) {
      await db
        .insert(permissions)
        .values(permission)
        .onConflictDoNothing({ target: [permissions.resource, permissions.action] });
    }

    console.log("[seed] Upsert de roles...");
    for (const role of ROLES) {
      await db
        .insert(roles)
        .values(role)
        .onConflictDoUpdate({
          target: roles.slug,
          set: { name: role.name, description: role.description, isSystem: role.isSystem },
        });
    }

    console.log("[seed] Vinculando role_permissions...");
    const allPermissions = await db.select().from(permissions);
    const allRoles = await db.select().from(roles);

    for (const [roleSlug, permissionSet] of Object.entries(ROLE_PERMISSIONS)) {
      const role = allRoles.find((candidate) => candidate.slug === roleSlug);
      if (!role) continue;

      const targetPermissions =
        permissionSet === "*"
          ? allPermissions
          : allPermissions.filter((permission) =>
              permissionSet.some(
                (seed) => seed.resource === permission.resource && seed.action === permission.action
              )
            );

      for (const permission of targetPermissions) {
        await db
          .insert(rolePermissions)
          .values({ roleId: role.id, permissionId: permission.id })
          .onConflictDoNothing();
      }
    }

    console.log("[seed] Concluído.");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("[seed] Falhou:", error);
  process.exitCode = 1;
});
