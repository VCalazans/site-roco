import "server-only";
import type { Session } from "next-auth";
import { auth } from "@/core/auth";

const ADMIN_ROLE_SLUG = "admin";

/**
 * Checagem pura de permissão (`resource:action`). Usuários com a role
 * `admin` sempre passam, independentemente das permissões carregadas.
 */
export function hasPermission(
  session: Session | null | undefined,
  resource: string,
  action: string
): boolean {
  const user = session?.user;
  if (!user) {
    return false;
  }
  if (user.roles?.includes(ADMIN_ROLE_SLUG)) {
    return true;
  }
  return user.permissions?.includes(`${resource}:${action}`) ?? false;
}

export class ForbiddenError extends Error {
  constructor(message = "Acesso negado.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Resolve a sessão atual e garante a permissão informada, lançando
 * `ForbiddenError` caso contrário. Uso em Server Actions/Route Handlers;
 * em tRPC prefira o middleware `permissionProcedure` (converte para
 * `TRPCError`).
 */
export async function requirePermission(resource: string, action: string): Promise<Session> {
  const session = await auth();
  if (!session?.user) {
    throw new ForbiddenError("Sessão não encontrada.");
  }
  if (!hasPermission(session, resource, action)) {
    throw new ForbiddenError(`Permissão negada para "${resource}:${action}".`);
  }
  return session;
}
