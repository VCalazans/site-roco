import "server-only";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { db } from "@/db";
import {
  accounts,
  permissions,
  representatives,
  rolePermissions,
  roles,
  sessions,
  userRoles,
  users,
  verificationTokens,
} from "@/db/schema";
import { checkRateLimit, normalizeRateLimitKeyPart } from "@/server/lib/rate-limit";

/** Role com acesso irrestrito — bypassa a checagem granular (ver `rbac.ts`). */
export const ADMIN_ROLE_SLUG = "admin";

/** Papel padrão para e-mails de domínio interno (`PORTAL_INTERNAL_EMAIL_DOMAIN`). */
const INTERNAL_DEFAULT_ROLE = "viewer";
/** Papel padrão para todos os demais e-mails (representantes externos). */
const EXTERNAL_DEFAULT_ROLE = "representative";

/**
 * Janela máxima de staleness do JWT: roles/permissions/`active` são recarregados
 * do banco quando o token está mais velho que isto. Sem esta revalidação, uma
 * desativação (`active=false`) ou mudança de papel só teria efeito no fim da
 * sessão (30 dias por padrão) — inaceitável num portal com RBAC.
 */
const AUTHORIZATION_MAX_AGE_MS = 5 * 60 * 1000;

/** Sessão do portal: 8h absolutas — janela B2B, não os 30 dias default. */
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

/**
 * Rate limit de login por credenciais (brute force). Duas chaves checadas em
 * paralelo: por e-mail alvo (impede tentar senhas contra UMA conta) e uma
 * global (impede rotacionar e-mails para escapar do limite por conta — janela
 * e teto maiores, pensados para não bloquear login legítimo em picos de uso
 * simultâneo do portal). Nenhuma das duas reseta em caso de sucesso — é
 * janela fixa (ver `checkRateLimit`), então mesmo um login válido conta.
 */
const LOGIN_RATE_LIMIT_WINDOW_SECONDS = 5 * 60;
const LOGIN_RATE_LIMIT_MAX_PER_EMAIL = 5;
const LOGIN_RATE_LIMIT_MAX_GLOBAL = 30;

async function loadUserAuthorization(userId: string) {
  const [account] = await db
    .select({ active: users.active })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // Usuário removido ou desativado: sinaliza para o callback derrubar a sessão.
  if (!account || account.active === false) {
    return null;
  }

  // Representante soft-disabled (2026-08-23, CRUD completo): o cadastro foi
  // desabilitado pelo admin (`representatives.disabledAt` setado). O login
  // é barrado exatamente como o `users.active=false` — mesma resposta
  // genérica (sem revelar que a conta está desabilitada por representante).
  // Apenas roles com a role `representative` checam; admin/sales_manager
  // (e viewer) não passam por esta gate.
  const [representativeRow] = await db
    .select({ disabledAt: representatives.disabledAt })
    .from(representatives)
    .where(eq(representatives.userId, userId))
    .limit(1);
  if (representativeRow?.disabledAt) {
    return null;
  }

  const assignedRoles = await db
    .select({ slug: roles.slug })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(eq(userRoles.userId, userId));

  const roleSlugs = assignedRoles.map((role) => role.slug);

  if (roleSlugs.length === 0) {
    return { roles: [] as string[], permissions: [] as string[] };
  }

  const rows = await db
    .select({ resource: permissions.resource, action: permissions.action })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(eq(userRoles.userId, userId));

  const permissionSlugs = Array.from(
    new Set(rows.map((row) => `${row.resource}:${row.action}`))
  );

  return { roles: roleSlugs, permissions: permissionSlugs };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) {
          return null;
        }

        const [emailRateLimit, globalRateLimit] = await Promise.all([
          checkRateLimit(`login:email:${normalizeRateLimitKeyPart(email)}`, {
            windowSeconds: LOGIN_RATE_LIMIT_WINDOW_SECONDS,
            max: LOGIN_RATE_LIMIT_MAX_PER_EMAIL,
          }),
          checkRateLimit("login:global", {
            windowSeconds: LOGIN_RATE_LIMIT_WINDOW_SECONDS,
            max: LOGIN_RATE_LIMIT_MAX_GLOBAL,
          }),
        ]);
        // Mesma resposta genérica de credenciais inválidas — nunca revela que
        // o bloqueio foi por rate limit (evitaria vazar timing/enumeração).
        if (!emailRateLimit.allowed || !globalRateLimit.allowed) {
          return null;
        }

        const [user] = await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            image: users.image,
            active: users.active,
            passwordHash: users.passwordHash,
          })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        // Conta inexistente, só-SSO (sem hash) ou desativada: mesma resposta
        // genérica — nunca revelar qual dos casos ocorreu.
        if (!user?.passwordHash || user.active === false) {
          return null;
        }

        const passwordMatches = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatches) {
          return null;
        }

        return { id: user.id, name: user.name, email: user.email, image: user.image };
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // `user` aqui já é o registro persistido (adapter roda antes deste
      // callback), então a coluna extra `active` está presente em runtime
      // mesmo não fazendo parte do tipo `User`/`AdapterUser` do Auth.js.
      const record = user as { active?: boolean };
      if (record.active === false) {
        return false;
      }
      return true;
    },
    async jwt({ token, user, trigger }) {
      const userId = user?.id ?? token.sub;
      if (!userId) {
        return token;
      }

      const refreshedAt = typeof token.authzRefreshedAt === "number" ? token.authzRefreshedAt : 0;
      const isStale = Date.now() - refreshedAt > AUTHORIZATION_MAX_AGE_MS;
      const shouldReload =
        trigger === "update" || Boolean(user) || !("roles" in token) || isStale;

      if (shouldReload) {
        const authorization = await loadUserAuthorization(userId);
        // `null` = usuário desativado/removido → invalida a sessão inteira.
        if (authorization === null) {
          return null;
        }
        token.roles = authorization.roles;
        token.permissions = authorization.permissions;
        token.authzRefreshedAt = Date.now();
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.roles = token.roles ?? [];
        session.user.permissions = token.permissions ?? [];
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.id || !user.email) {
        return;
      }

      const internalDomain = process.env.PORTAL_INTERNAL_EMAIL_DOMAIN?.toLowerCase();
      const isInternalEmail =
        Boolean(internalDomain) && user.email.toLowerCase().endsWith(`@${internalDomain}`);
      const defaultRoleSlug = isInternalEmail ? INTERNAL_DEFAULT_ROLE : EXTERNAL_DEFAULT_ROLE;

      const [defaultRole] = await db
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.slug, defaultRoleSlug))
        .limit(1);

      // Sem o seed (`npm run db:seed`) a role ainda não existe — o usuário
      // fica sem papel até uma atribuição manual, sem quebrar o login.
      if (!defaultRole) {
        return;
      }

      await db
        .insert(userRoles)
        .values({ userId: user.id, roleId: defaultRole.id })
        .onConflictDoNothing();
    },
  },
});
