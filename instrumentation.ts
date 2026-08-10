/**
 * Hook de instrumentação do Next.js — usado aqui só para subir os workers
 * BullMQ do portal (fila `erp-sync`) in-process, no boot do servidor Node.
 * Guard de runtime evita rodar em Edge (proxy.ts sempre roda em Node, mas
 * outras partes do app podem ser avaliadas em runtimes distintos).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startWorkers } = await import("@/core/queue/register-workers");
    startWorkers();
  }
}
