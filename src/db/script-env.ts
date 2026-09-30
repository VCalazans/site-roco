/**
 * Ambiente dos scripts de banco que rodam FORA do Next (`tsx src/db/...`):
 * carregam sozinhos o `.env.local` e o `.env` da raiz do repositório — o Next
 * faz isso para a aplicação, mas não para um script avulso.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** `.env.local` e depois `.env`; variável já definida no processo nunca é sobrescrita. */
export function loadEnvFiles(): void {
  for (const file of [".env.local", ".env"]) {
    const fullPath = path.join(repoRoot, file);
    if (!fs.existsSync(fullPath)) continue;
    for (const line of fs.readFileSync(fullPath, "utf8").split(/\r?\n/)) {
      const match = /^([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!match || line.trimStart().startsWith("#")) continue;
      const [, name, rawValue] = match;
      if (process.env[name] !== undefined) continue;
      process.env[name] = rawValue.replace(/^(['"])(.*)\1$/, "$2");
    }
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} não configurada (ver .env.local).`);
  }
  return value;
}
