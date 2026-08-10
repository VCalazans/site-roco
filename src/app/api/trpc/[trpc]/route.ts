import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createTRPCContext } from "@/server/trpc/init";
import { appRouter } from "@/server/trpc/routers/_app";

function handler(request: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: request,
    router: appRouter,
    createContext: () => createTRPCContext(),
    onError:
      process.env.NODE_ENV === "development"
        ? ({ path, error }) => {
            // Nunca logar dados de sessão/permissão — só path e mensagem do erro.
            console.error(`[trpc] ${path ?? "<no-path>"}:`, error.message);
          }
        : undefined,
  });
}

export { handler as GET, handler as POST };
