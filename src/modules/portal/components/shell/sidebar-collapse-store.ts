/**
 * Preferência "sidebar recolhida" do portal, persistida por navegador em
 * `localStorage` e exposta como store externo para `useSyncExternalStore`.
 *
 * Por que não `useState(() => localStorage...)`: o inicializador lazy roda no
 * servidor (`false`) e de novo na hidratação (valor real). Quando os dois
 * diferem, o HTML entregue tem as classes do drawer expandido e o React não
 * corrige atributos divergentes na hidratação — a sidebar ficava desenhada
 * aberta com o estado interno "recolhida" (ícone do toggle trocado, layout
 * errado). Com `useSyncExternalStore` o React renderiza a hidratação com o
 * snapshot de servidor (`false`) e reconcilia com o valor real logo depois,
 * sem aviso e sem estado inconsistente.
 */
export const SIDEBAR_COLLAPSE_STORAGE_KEY = "portal_sidebar_collapsed";

const listeners = new Set<() => void>();

/**
 * Valor em memória usado só quando o `localStorage` está indisponível (modo
 * restrito/privado de alguns navegadores): o toggle continua funcionando na
 * sessão, apenas não sobrevive a um reload.
 */
let memoryFallback: boolean | null = null;

function readStored(): boolean {
  if (memoryFallback !== null) return memoryFallback;
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function subscribeSidebarCollapsed(onChange: () => void): () => void {
  listeners.add(onChange);
  // `storage` só dispara em OUTRAS abas — mantém as abas do portal alinhadas.
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === SIDEBAR_COLLAPSE_STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function getSidebarCollapsedSnapshot(): boolean {
  return readStored();
}

export function getSidebarCollapsedServerSnapshot(): boolean {
  return false;
}

export function setSidebarCollapsed(next: boolean): void {
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSE_STORAGE_KEY, String(next));
    memoryFallback = null;
  } catch {
    memoryFallback = next;
  }
  listeners.forEach((listener) => listener());
}
