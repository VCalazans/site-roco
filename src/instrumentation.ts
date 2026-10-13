/**
 * Hook de instrumentação do Next.js — usado aqui só para subir os workers
 * BullMQ do portal (fila `erp-sync`) in-process, no boot do servidor Node.
 * Guard de runtime evita rodar em Edge (proxy.ts sempre roda em Node, mas
 * outras partes do app podem ser avaliadas em runtimes distintos).
 *
 * ⚠️ ESTE ARQUIVO PRECISA FICAR EM `src/`, NUNCA NA RAIZ DO REPO — a mesma
 * armadilha do `src/proxy.ts`. Com `app/` em `src/app`, o `next build` só
 * procura o hook em `src/`. Enquanto ele esteve na raiz (até 2026-10-12), o
 * Turbopack até o compilava, mas a saída `standalone` (a imagem Docker) não o
 * levava: o `register()` nunca rodou em produção nem na homologação, e o
 * `/api/health` autenticado mostrava `workers: { running: false, reason:
 * "not-initialized" }` — o webhook do ERP enfileiraria jobs que ninguém
 * consome. Conferência depois do build: `.next/standalone/.next/server/
 * instrumentation.js` tem de existir.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startWorkers } = await import("@/core/queue/register-workers");
    startWorkers();
  }
}
