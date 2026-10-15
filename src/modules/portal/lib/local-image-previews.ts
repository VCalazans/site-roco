"use client";

import { useSyncExternalStore } from "react";

/**
 * Prévias locais das fotos de produto mexidas nesta aba do portal.
 *
 * Ao enviar, a URL pública da imagem passa a apontar para o `blob:` do
 * arquivo escolhido: a miniatura (no cadastro e na tabela de produtos) aparece
 * na hora, sem baixar o original do servidor. Ao excluir, a URL entra na lista
 * de removidas e a miniatura some antes de a lista do servidor voltar.
 *
 * Vale só para esta aba e até recarregar a página. Os `blob:` não são
 * liberados de propósito: a tabela pode continuar exibindo a prévia depois
 * que o diálogo do produto fecha.
 */
type Snapshot = {
  previews: ReadonlyMap<string, string>;
  removed: ReadonlySet<string>;
};

let snapshot: Snapshot = { previews: new Map(), removed: new Set() };
const listeners = new Set<() => void>();
const SERVER_SNAPSHOT: Snapshot = { previews: new Map(), removed: new Set() };

function emit(next: Snapshot) {
  snapshot = next;
  for (const listener of listeners) listener();
}

/** A imagem `serverUrl` acabou de ser enviada a partir de `previewUrl` (blob:). */
export function registerLocalPreview(serverUrl: string, previewUrl: string) {
  if (!serverUrl) return;
  const previews = new Map(snapshot.previews);
  previews.set(serverUrl, previewUrl);
  const removed = new Set(snapshot.removed);
  removed.delete(serverUrl);
  emit({ previews, removed });
}

/** A imagem `serverUrl` foi excluída (ou a exclusão foi desfeita, com `undo`). */
export function markImageRemoved(serverUrl: string, undo = false) {
  if (!serverUrl) return;
  const removed = new Set(snapshot.removed);
  if (undo) removed.delete(serverUrl);
  else removed.add(serverUrl);
  emit({ previews: snapshot.previews, removed });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Fonte a exibir para uma imagem do servidor: a prévia local quando existe,
 * `null` quando a imagem foi excluída nesta aba, ou a própria URL.
 */
export function useLocalImageSrc(serverUrl: string | null | undefined): string | null {
  const current = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => SERVER_SNAPSHOT
  );
  if (!serverUrl) return null;
  if (current.removed.has(serverUrl)) return null;
  return current.previews.get(serverUrl) ?? serverUrl;
}
