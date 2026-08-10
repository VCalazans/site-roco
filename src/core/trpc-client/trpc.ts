"use client";

import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "@/server/trpc/routers/_app";

/**
 * `AppRouter` é importado só como TIPO (`import type`) — não cria
 * acoplamento runtime com `src/server/**`, que é de outro agente (backend,
 * em paralelo). Nesta onda o router raiz só expõe `health`
 * (`src/server/trpc/routers/_app.ts`); os routers `products`,
 * `representatives` e `sync` do contrato ainda não foram mergeados. Todo uso
 * de `trpc.products.*` / `trpc.representatives.*` / `trpc.sync.*` neste
 * módulo portal falha em `npx tsc --noEmit` até o merge — documentado no
 * relatório final desta onda, arquivo por arquivo.
 */
export const { TRPCProvider, useTRPC, useTRPCClient } =
  createTRPCContext<AppRouter>();
