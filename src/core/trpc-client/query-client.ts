import { QueryClient } from "@tanstack/react-query";

/**
 * Uma instância por request no server, uma instância única por aba no
 * browser (module-level singleton) — padrão recomendado pela documentação do
 * tRPC v11 + TanStack Query para App Router. O portal é client-first nesta
 * onda (sem prefetch/hydration em Server Components), mas a função já segue
 * o formato SSR-safe para não exigir retrabalho se uma página futura quiser
 * prefetch.
 */
function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") {
    // Server: sempre uma instância nova (nunca reusar entre requests).
    return makeQueryClient();
  }
  // Browser: reusa a mesma instância entre re-renders/navegações client-side.
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
