/**
 * Payload do job `erp-sync`. O contrato definitivo do ERP (schema exato de
 * cada item de `products`) ainda não foi fechado — `products` aceita
 * qualquer shape e é validado item-a-item no processor (ver
 * `erp-sync-processor.ts`), descartando entradas inválidas em vez de
 * derrubar o job inteiro.
 */
export interface ErpSyncJobData {
  triggeredBy: "manual" | "webhook";
  /** userId de quem disparou manualmente (tRPC `sync.trigger`). */
  requestedBy?: string;
  /** Nome do evento do webhook (ex.: "product.updated"), quando aplicável. */
  event?: string;
  /** Itens de produto no formato bruto do ERP — ausente/vazio = full-sync (não implementado). */
  products?: unknown[];
}
