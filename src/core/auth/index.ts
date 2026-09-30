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
import { emailRateLimitKey } from "@/server/lib/account-tokens";
import { checkRateLimit, getClientIp, normalizeRateLimitKeyPart } from "@/server/lib/rate-limit";
import { isGoogleSignInEnabled } from "./google";
import { EmailNotVerifiedError, LoginRateLimitedError, LoginUnavailableError } from "./sign-in-errors";

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
 * Rate limit de login por credenciais (força bruta), com duas chaves checadas
 * em paralelo: por IP (quem tenta muitas contas a partir do mesmo lugar) e por
 * e-mail alvo (quem tenta muitas senhas contra UMA conta; a chave leva o hash
 * do e-mail, nunca o e-mail em claro). Janela fixa: mesmo um login válido
 * conta. FAIL-CLOSED (`productionSafe`): sem o limitador em produção, o login
 * recusa em vez de liberar tentativas ilimitadas.
 *
 * Não existe mais um teto GLOBAL: 30 tentativas de qualquer origem a cada
 * 5 min bloqueavam o login de TODO mundo, inclusive do admin (revisão de
 * segurança de 2026-09-30). O por-IP tem folga para um escritório inteiro
 * atrás do mesmo IP.
 */
const LOGIN_RATE_LIMIT_WINDOW_SECONDS = 5 * 60;
const LOGIN_RATE_LIMIT_MAX_PER_EMAIL = 5;
const LOGIN_RATE_LIMIT_MAX_PER_IP = 20;

/**
 * Hash bcrypt (custo 12) de um texto aleatório descartado: quando a conta não
 * existe, não tem senha ou está desativada, a senha digitada é comparada com
 * ele — o login leva o mesmo tempo nos dois caminhos, e o tempo de resposta
 * não denuncia se o e-mail tem conta.
 */
const TIMING_EQUALIZER_HASH = "$2b$12$ymMOedZNBaIdAqPP2Vgnte/cDpzZ4TSa5tNENjpF7iIzxpB1js1Ci";

async function loadUserAuthorization(userId: string) {
  const [account] = await db
    .select({ active: users.active, passwordChangedAt: users.passwordChangedAt })
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
  const passwordChangedAt = account.passwordChangedAt;

  if (roleSlugs.length === 0) {
    return { roles: [] as string[], permissions: [] as string[], passwordChangedAt };
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

  return { roles: roleSlugs, permissions: permissionSlugs, passwordChangedAt };
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
    // Google só com opt-in explícito (`AUTH_GOOGLE_ENABLED=true`) — ver `./google.ts`.
    ...(isGoogleSignInEnabled()
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
          }),
        ]
      : []),
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials, request) {
        const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) {
          return null;
        }

        const ip = request ? getClientIp(request) : "unknown";
        const [ipRateLimit, emailRateLimit] = await Promise.all([
          checkRateLimit(`login:ip:${normalizeRateLimitKeyPart(ip)}`, {
            windowSeconds: LOGIN_RATE_LIMIT_WINDOW_SECONDS,
            max: LOGIN_RATE_LIMIT_MAX_PER_IP,
            productionSafe: true,
          }),
          checkRateLimit(emailRateLimitKey("login", email), {
            windowSeconds: LOGIN_RATE_LIMIT_WINDOW_SECONDS,
            max: LOGIN_RATE_LIMIT_MAX_PER_EMAIL,
            productionSafe: true,
          }),
        ]);
        // Mensagens próprias (a tela explica o que houve). Nenhuma revela se a
        // conta existe: os dois limites valem para qualquer e-mail digitado.
        if (ipRateLimit.unavailable || emailRateLimit.unavailable) {
          throw new LoginUnavailableError();
        }
        if (!ipRateLimit.allowed || !emailRateLimit.allowed) {
          throw new LoginRateLimitedError();
        }

        const [user] = await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            image: users.image,
            active: users.active,
            passwordHash: users.passwordHash,
            emailVerified: users.emailVerified,
          })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        // Conta inexistente, só-SSO (sem hash) ou desativada: mesma resposta
        // genérica — nunca revelar qual dos casos ocorreu. O bcrypt roda
        // mesmo assim, para o tempo de resposta também não revelar.
        if (!user?.passwordHash || user.active === false) {
          await bcrypt.compare(password, TIMING_EQUALIZER_HASH);
          return null;
        }

        const passwordMatches = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatches) {
          return null;
        }

        // Senha certa, e-mail ainda não confirmado pelo link do cadastro: a
        // tela de login pede a confirmação (e oferece reenviar o link). Só
        // depois de a senha conferir — sem ela, a resposta segue genérica.
        if (!user.emailVerified) {
          throw new EmailNotVerifiedError();
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

      // Momento do login que emitiu este token (comparado com a última troca de senha).
      if (user) {
        token.authAt = Date.now();
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
        // Senha redefinida DEPOIS deste login → a sessão cai (≤ 5 min, na
        // revalidação). Quem redefiniu por ter perdido o controle da conta
        // tira de dentro quem estava usando a senha antiga.
        const authAt = typeof token.authAt === "number" ? token.authAt : 0;
        if (authorization.passwordChangedAt && authorization.passwordChangedAt.getTime() > authAt) {
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
