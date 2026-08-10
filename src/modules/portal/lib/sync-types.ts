/** Espelho local do retorno de `sync.status()` (contrato tRPC — router `sync`). */
export type SyncState = "idle" | "running" | "error";

export type SyncStatus = {
  status: SyncState;
  lastRunAt: string | null;
  error?: string | null;
};
