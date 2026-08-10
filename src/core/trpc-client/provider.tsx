"use client";

import { useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@/server/trpc/routers/_app";
import { getQueryClient } from "./query-client";
import { TRPCProvider } from "./trpc";

type TRPCReactProviderProps = {
  children: ReactNode;
};

/**
 * Provider client-side do tRPC para o Portal Interno. Monta o link de
 * batching (`httpBatchLink`) contra `/api/trpc` — mesma origem do site, sem
 * CORS — e expõe `useTRPC()`/`useTRPCClient()` (`./trpc.ts`) para os
 * componentes de `src/modules/portal/**`.
 *
 * Montado em `(internal)/layout.tsx`, como irmão de `PortalProviders` (MUI):
 * os dois providers são independentes (um resolve tema, o outro dados) e não
 * precisam de ordem de aninhamento específica entre si.
 *
 * `useState(() => createTRPCClient(...))` garante um único client por
 * montagem do componente (não recria a cada render) sem precisar de
 * `useMemo` — mesmo padrão do exemplo oficial do tRPC para App Router.
 */
export function TRPCReactProvider({ children }: TRPCReactProviderProps) {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url: "/api/trpc",
        }),
      ],
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
