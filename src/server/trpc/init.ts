import "server-only";
import { initTRPC, TRPCError } from "@trpc/server";
import { cache } from "react";
import { auth } from "@/core/auth";
import { hasPermission } from "@/core/auth/rbac";
import { db } from "@/db";

/**
 * Contexto por-request do tRPC. `cache()` evita chamar `auth()` mais de uma
 * vez por request quando vários procedures/routers a acessam.
 */
export const createTRPCContext = cache(async () => {
  const session = await auth();
  return { session, db };
});

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;
export const middleware = t.middleware;

/** Sem restrição de sessão/permissão. */
export const publicProcedure = t.procedure;

/** Exige sessão autenticada. */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});

/**
 * Factory de procedure com checagem RBAC granular (`resource:action`).
 * Admin sempre passa (ver `hasPermission`).
 */
export function permissionProcedure(resource: string, action: string) {
  return protectedProcedure.use(({ ctx, next }) => {
    if (!hasPermission(ctx.session, resource, action)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Permissão negada para "${resource}:${action}".`,
      });
    }
    return next({ ctx });
  });
}
