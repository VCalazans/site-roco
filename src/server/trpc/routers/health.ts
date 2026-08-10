import { publicProcedure, router } from "../init";

/** Router de diagnóstico — sem dados sensíveis, útil para smoke tests/uptime checks. */
export const healthRouter = router({
  ping: publicProcedure.query(() => ({
    status: "ok" as const,
    timestamp: new Date().toISOString(),
  })),
});
