import { index, pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { users } from "./auth";

/** Para que serve o link enviado por e-mail. */
export const accountTokenPurposeEnum = pgEnum("account_token_purpose", ["email_verification", "password_reset"]);

/**
 * Tokens dos links enviados por e-mail (confirmação de cadastro e
 * redefinição de senha).
 *
 * O token em si NUNCA é gravado: só o SHA-256 dele (`token_hash`). Quem lê o
 * banco (backup, réplica, log de query) não consegue usar um link pendente.
 * Cada token tem validade (`expires_at`) e uso único (`used_at`, marcado de
 * forma atômica no consumo); pedir um link novo invalida os anteriores do
 * mesmo tipo.
 */
export const accountTokens = pgTable(
  "account_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: accountTokenPurposeEnum("purpose").notNull(),
    /** SHA-256 (hex) do token enviado no link. */
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** IP de quem pediu o link (auditoria/abuso); nunca exibido. */
    requestedIp: varchar("requested_ip", { length: 45 }),
  },
  (table) => [index("account_tokens_user_purpose_idx").on(table.userId, table.purpose)]
);
