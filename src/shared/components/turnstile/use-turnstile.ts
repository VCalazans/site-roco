"use client";

import { useCallback, useRef, useState, type RefObject } from "react";
import { getTurnstileSiteKey } from "@/shared/lib/turnstile";
import type { TurnstileFailure, TurnstileWidgetHandle } from "./turnstile-widget";

export type TurnstileState = {
  /** Há site key no build: o widget aparece e o envio espera o token. */
  enabled: boolean;
  /** Token atual (uso único) ou `null`. */
  token: string | null;
  /** Widget ligado e ainda sem token — o botão de enviar fica desabilitado. */
  pending: boolean;
  /** Último problema do widget; some quando um token novo chega. */
  failure: TurnstileFailure | null;
  /** Descarta o token e pede outro. Chamar depois de TODA tentativa de envio. */
  reset: () => void;
  /** Props para o `<TurnstileWidget>` do formulário (`{...turnstile.widget}`). */
  widget: {
    ref: RefObject<TurnstileWidgetHandle | null>;
    onTokenChange: (token: string | null) => void;
    onFailure: (failure: TurnstileFailure) => void;
  };
};

/**
 * Estado do Turnstile de um formulário: o token que vai no corpo, se o envio
 * precisa esperar e o que mostrar quando o widget falha. Sem site key no build
 * (`enabled: false`) nada muda no formulário: token `null`, nunca pendente.
 */
export function useTurnstile(): TurnstileState {
  const enabled = getTurnstileSiteKey() !== "";
  const ref = useRef<TurnstileWidgetHandle | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [failure, setFailure] = useState<TurnstileFailure | null>(null);

  const onTokenChange = useCallback((next: string | null) => {
    setToken(next);
    if (next) setFailure(null);
  }, []);

  const reset = useCallback(() => {
    setToken(null);
    // Script que não carregou não volta com reset — a mensagem continua.
    setFailure((current) => (current === "load" ? current : null));
    ref.current?.reset();
  }, []);

  return {
    enabled,
    token,
    pending: enabled && !token,
    failure,
    reset,
    widget: { ref, onTokenChange, onFailure: setFailure },
  };
}
