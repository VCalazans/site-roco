import { defineConfig } from "drizzle-kit";

/**
 * Config do drizzle-kit (CLI). `generate` só lê os arquivos de schema — não
 * conecta ao banco — então `DATABASE_URL` pode estar ausente nesse comando.
 * `migrate`/`push`/`studio` exigem uma `DATABASE_URL` real.
 */
export default defineConfig({
  schema: "./src/db/schema",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://user:password@localhost:5432/roco_portal",
  },
});
