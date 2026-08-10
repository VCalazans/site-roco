import type { DefaultSession } from "next-auth";

/**
 * Module augmentation do Auth.js: embute `id`, `roles` e `permissions`
 * (formato `"resource:action"`) na sessão e no JWT, carregados em
 * `src/core/auth/index.ts`.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      roles: string[];
      permissions: string[];
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    roles?: string[];
    permissions?: string[];
    /** Epoch ms da última recarga de roles/permissions do banco (staleness). */
    authzRefreshedAt?: number;
  }
}

// `next-auth/jwt` só faz `export * from "@auth/core/jwt"`; os callbacks do
// Auth.js resolvem o tipo `JWT` a partir do módulo original — augmentar só
// "next-auth/jwt" não é suficiente para o merge valer nos callbacks.
declare module "@auth/core/jwt" {
  interface JWT {
    roles?: string[];
    permissions?: string[];
    /** Epoch ms da última recarga de roles/permissions do banco (staleness). */
    authzRefreshedAt?: number;
  }
}
