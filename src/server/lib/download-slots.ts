/**
 * Vagas de download pesado NESTE processo: um teto por usuário e um total.
 *
 * Em memória de propósito — o recurso protegido é local: o pool de conexões
 * do cliente S3 (50 sockets, compartilhado com upload e exclusão de
 * arquivos) e o event loop deste processo. Cada réplica tem os seus, então o
 * teto certo é por processo; um contador no Redis limitaria o total do
 * cluster, não o que cada processo aguenta.
 */
export type DownloadSlot = {
  /** Devolve a vaga. Idempotente: chamar de novo não faz nada. */
  release: () => void;
};

export type AcquireResult = { ok: true; slot: DownloadSlot } | { ok: false; reason: "user" | "total" };

export type DownloadSlots = {
  tryAcquire: (userId: string) => AcquireResult;
  /** Vagas ocupadas agora (para teste e diagnóstico). */
  inUse: () => number;
};

export function createDownloadSlots(limits: { perUser: number; total: number }): DownloadSlots {
  const byUser = new Map<string, number>();
  let total = 0;

  function tryAcquire(userId: string): AcquireResult {
    const mine = byUser.get(userId) ?? 0;
    if (mine >= limits.perUser) return { ok: false, reason: "user" };
    if (total >= limits.total) return { ok: false, reason: "total" };
    byUser.set(userId, mine + 1);
    total += 1;

    let released = false;
    return {
      ok: true,
      slot: {
        release() {
          if (released) return;
          released = true;
          total -= 1;
          const left = (byUser.get(userId) ?? 1) - 1;
          if (left > 0) byUser.set(userId, left);
          else byUser.delete(userId);
        },
      },
    };
  }

  return { tryAcquire, inUse: () => total };
}
