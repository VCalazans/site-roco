import "server-only";
import { TRPCError } from "@trpc/server";
import { desc } from "drizzle-orm";
import { syncRuns } from "@/db/schema";
import { getErpSyncQueue } from "@/core/queue/erp-sync-queue";
import { erpSyncJobId } from "@/core/queue/job-id";
import { permissionProcedure, router } from "../init";

export const syncRouter = router({
  trigger: permissionProcedure("sync", "trigger").mutation(async ({ ctx }) => {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Sincronização indisponível: fila (Redis) não configurada.",
      });
    }

    const jobId = erpSyncJobId();

    try {
      const queue = getErpSyncQueue(redisUrl);
      await queue.add(
        "erp-sync",
        { triggeredBy: "manual" as const, requestedBy: ctx.session.user.id },
        { jobId }
      );
    } catch (error) {
      console.error("[sync.trigger] Falha ao enfileirar job.", error);
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Sincronização indisponível: não foi possível conectar à fila.",
      });
    }

    return { queued: true as const, jobId };
  }),

  /**
   * Status derivado do sync ERP: `status`/`lastRunAt`/`error` refletem a
   * última execução (para a barra de sync na página de produtos, que faz
   * poll enquanto `status === "running"`); `runs` traz as últimas 10
   * execuções completas (auditoria/histórico).
   */
  status: permissionProcedure("sync", "read").query(async ({ ctx }) => {
    const runs = await ctx.db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(10);
    const latest = runs[0];

    let status: "idle" | "running" | "error" = "idle";
    if (latest?.status === "running" || latest?.status === "queued") {
      status = "running";
    } else if (latest?.status === "error") {
      status = "error";
    }

    return {
      status,
      lastRunAt: (latest?.finishedAt ?? latest?.startedAt)?.toISOString() ?? null,
      error: latest?.status === "error" ? latest.error : null,
      runs,
    };
  }),
});
