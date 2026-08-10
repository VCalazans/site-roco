/**
 * Tabelas exigidas pelo `@auth/drizzle-adapter` (Auth.js v5) para o dialeto
 * Postgres. Nomes de tabela/coluna seguem EXATAMENTE o padrão oficial do
 * adapter (ver `node_modules/@auth/drizzle-adapter/src/lib/pg.ts`) para que
 * `DrizzleAdapter(db, { usersTable, accountsTable, sessionsTable,
 * verificationTokensTable })` funcione sem mapeamento adicional.
 *
 * `users.id` é `text` (não `uuid`) de propósito — é o tipo que o adapter
 * oficial usa (`crypto.randomUUID()` como default), o que mantém a
 * compatibilidade de tipos com `PostgresDrizzleAdapter` sem precisar
 * satisfazer os generics internos do adapter manualmente. Tabelas do domínio
 * do portal que referenciam usuário (roles, representatives, audit) usam
 * `text` para a FK por este motivo.
 */
import { boolean, integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  /** Desliga o acesso do usuário sem apagar histórico (RBAC/auditoria). */
  active: boolean("active").notNull().default(true),
  /**
   * Login tradicional (Credentials provider): hash bcrypt da senha. `null`
   * para contas que só usam Google SSO — o provider de credenciais rejeita
   * usuários sem hash, então os dois modos convivem sem conflito.
   */
  passwordHash: text("passwordHash"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ]
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (verificationToken) => [
    primaryKey({ columns: [verificationToken.identifier, verificationToken.token] }),
  ]
);
