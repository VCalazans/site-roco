/**
 * Chave idempotente do job `erp-sync`: um disparo por minuto (UTC), qualquer
 * origem (tRPC `sync.trigger` ou webhook do ERP). BullMQ recusa/reaproveita
 * jobs com o mesmo `jobId` enquanto ele ainda existir na fila.
 */
export function erpSyncJobId(date: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const bucket =
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}`;
  return `erp-sync:${bucket}`;
}
