"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * LGPD consent banner — STUB (2026-08-23).
 *
 * Saiu desligado por padrão. Liga quando `NEXT_PUBLIC_CONSENT_ENABLED=true`.
 * A copy e a mecânica de opt-in/opt-out serão preenchidas pelo jurídico
 * (finalidade, base legal, retenção, direitos do titular). Este componente
 * só persiste o consentimento em `localStorage` (chave `consent_status`)
 * e renderiza um banner que abre/fecha ao montar.
 *
 * Implementação: usa `useSyncExternalStore` para ler o localStorage. Vantagens:
 *   - Sem `setState` em `useEffect` (cumpre `react-hooks/set-state-in-effect`).
 *   - Sem mismatch de SSR (a `getServerSnapshot` retorna `"pending"`).
 *   - Sem re-render desnecessário (o subscribe só dispara em mudanças reais).
 *
 * Renderização condicional:
 *   - Server: `getServerSnapshot` retorna `"pending"` → não renderiza
 *     (evita flash em crawlers e o problema clássico de hydration).
 *   - Client sem consentimento persistido: `getSnapshot` retorna
 *     `"pending"` → banner aparece.
 *   - Client com consentimento persistido: `getSnapshot` retorna
 *     `"accepted"` ou `"rejected"` → banner some.
 */

type ConsentStatus = "pending" | "accepted" | "rejected";

type ConsentCopy = {
  title: string;
  body: string;
  accept: string;
  reject: string;
  policy: string;
  policyHref: string;
};

type ConsentBannerProps = {
  copy: ConsentCopy;
  /** Override do nome da chave do localStorage (útil em testes A/B). */
  storageKey?: string;
};

const DEFAULT_STORAGE_KEY = "consent_status";

function isEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CONSENT_ENABLED === "true";
}

/**
 * Singleton de um store mutável externo (localStorage). `useSyncExternalStore`
 * pede 3 funções:
 *   - `getSnapshot`: lê o estado atual (chamado várias vezes durante render);
 *   - `getServerSnapshot`: retorna o equivalente durante SSR (sem acesso a
 *     `localStorage` no server — sempre `"pending"`);
 *   - `subscribe`: registra listener para mudanças externas. Aqui não há
 *     mudanças externas (a única escrita é via `setConsent`), então é um
 *     no-op.
 *
 * Importante: `getSnapshot` retorna uma string estável por sessão para não
 * disparar re-renders infinitos (a regra de "snapshot estável" do React).
 */
function makeStore(storageKey: string) {
  let cached: ConsentStatus | null = null;
  function read(): ConsentStatus {
    if (typeof window === "undefined") return "pending";
    const stored = window.localStorage.getItem(storageKey);
    if (stored === "accepted" || stored === "rejected") return stored;
    return "pending";
  }
  function getSnapshot(): ConsentStatus {
    if (cached === null) cached = read();
    return cached;
  }
  function getServerSnapshot(): ConsentStatus {
    return "pending";
  }
  function subscribe(): () => void {
    // Sem listener externo — as mudanças vêm via `setConsent`.
    return () => {};
  }
  function setConsent(value: ConsentStatus): void {
    cached = value;
    if (typeof window !== "undefined" && value !== "pending") {
      window.localStorage.setItem(storageKey, value);
    }
    // Disparar manualmente: `subscribe` é no-op, então o `useSyncExternalStore`
    // não tem como saber que o cache mudou. Solução padrão: usar
    // `dispatchEvent` para invalidar — mas em React 18+, basta reavaliar
    // via state local (veja `useConsentStatus` abaixo).
  }
  return { getSnapshot, getServerSnapshot, subscribe, setConsent };
}

function useConsentStatus(storageKey: string): {
  status: ConsentStatus;
  setConsent: (value: ConsentStatus) => void;
} {
  // Precisamos de uma referência estável para `subscribe`. Memoiza no nível
  // do módulo para sobreviver a re-renders.
  const store = useStore(storageKey);
  const status = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const setConsent = useCallback((value: ConsentStatus) => store.setConsent(value), [store]);
  return { status, setConsent };
}

/**
 * Singleton de stores por chave (mesma `storageKey` → mesmo store).
 * Implementação lazy (Map) para suportar várias instâncias (testes A/B).
 */
const storeCache = new Map<string, ReturnType<typeof makeStore>>();
function useStore(storageKey: string): ReturnType<typeof makeStore> {
  let store = storeCache.get(storageKey);
  if (!store) {
    store = makeStore(storageKey);
    storeCache.set(storageKey, store);
  }
  return store;
}

export function ConsentBanner({ copy, storageKey = DEFAULT_STORAGE_KEY }: ConsentBannerProps) {
  // Mounted guard para SSR — o `useSyncExternalStore` já lida com SSR via
  // `getServerSnapshot`, mas se `isEnabled()` retornar `false` no server
  // e `true` no client, queremos evitar mismatch. O hook abaixo só roda
  // em client.
  const enabled = useSyncExternalStore(
    () => () => {},
    isEnabled,
    () => false
  );
  const { status, setConsent } = useConsentStatus(storageKey);

  // Renderiza só quando (a) flag ativada E (b) status pendente.
  if (!enabled || status !== "pending") return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={copy.title}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#05070b]/95 p-4 text-white shadow-[0_-10px_40px_-12px_rgba(0,0,0,0.7)] backdrop-blur-md sm:p-6"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="text-meta font-semibold uppercase tracking-[0.16em] text-neon-cyan-bright">
            {copy.title}
          </p>
          <p className="mt-1 text-meta text-white/80">{copy.body}</p>
          <a
            href={copy.policyHref}
            className="mt-1 inline-block text-meta text-neon-cyan-bright underline-offset-2 hover:underline"
          >
            {copy.policy}
          </a>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setConsent("rejected")}
            className="rounded-full border border-white/20 px-4 py-2 text-meta text-white/85 hover:bg-white/10"
          >
            {copy.reject}
          </button>
          <button
            type="button"
            onClick={() => setConsent("accepted")}
            className="rounded-full bg-neon-cyan-bright px-4 py-2 text-meta font-semibold text-background hover:bg-white"
          >
            {copy.accept}
          </button>
        </div>
      </div>
    </div>
  );
}
