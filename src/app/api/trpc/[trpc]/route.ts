import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { errorRefOf, isInternalError, isUnexpectedError, unexpectedErrorCode } from "@/server/lib/trpc-errors";
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
      // inteira; em produção, só os erros INTERNOS, sem a mensagem da causa (a do
      // Drizzle traz a consulta com os parâmetros): referência (a mesma que a
      // tela mostra), path e código do banco.
      if (process.env.NODE_ENV === "development") {
        console.error(`[trpc] ${path ?? "<no-path>"}:`, error.message, error.cause ?? "");
      } else if (isInternalError(error)) {
        const code = unexpectedErrorCode(error);
        // Mensagem só quando é nossa (ex.: "Falha ao criar o produto."); a de erro inesperado é a da causa.
        const message = isUnexpectedError(error) ? "erro inesperado" : error.message;
        console.error(
          `[trpc] ref ${errorRefOf(error)} · ${path ?? "<no-path>"}: ${message}${code ? ` (código ${code})` : ""}`
        );
      }
    },
  });
}

export { handler as GET, handler as POST };
