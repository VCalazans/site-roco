import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { isUnexpectedError, unexpectedErrorCode } from "@/server/lib/trpc-errors";
import { createTRPCContext } from "@/server/trpc/init";
import { appRouter } from "@/server/trpc/routers/_app";

function handler(request: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: request,
    router: appRouter,
    createContext: () => createTRPCContext(),
    onError: ({ path, error }) => {
      // Nunca logar dados de sessão/permissão. Em desenvolvimento, a mensagem
      // inteira; em produção, só os erros INESPERADOS, e sem a mensagem (a do
      // Drizzle traz a consulta com os parâmetros) — path e código do banco.
      if (process.env.NODE_ENV === "development") {
        console.error(`[trpc] ${path ?? "<no-path>"}:`, error.message);
      } else if (isUnexpectedError(error)) {
        const code = unexpectedErrorCode(error);
        console.error(`[trpc] ${path ?? "<no-path>"}: erro inesperado${code ? ` (código ${code})` : ""}.`);
      }
    },
  });
}

export { handler as GET, handler as POST };
