"use client";

import { useEffect, useRef, useState } from "react";
import type { AccountLinkFailure, PortalAccountDictionary } from "./types";

/** Rotas públicas de conta (`src/app/api/account/*`). */
export const ACCOUNT_API = {
  token: "/api/account/token",
  resendVerification: "/api/account/verification/resend",
  confirmVerification: "/api/account/verification/confirm",
  forgotPassword: "/api/account/password/forgot",
  resetPassword: "/api/account/password/reset",
} as const;

export type AccountApiResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string; issue?: string };

/** POST JSON para uma rota de conta; nunca lança (rede fora vira `generic`). */
export async function postAccount(path: string, body: Record<string, unknown>): Promise<AccountApiResult> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (response.ok) return { ok: true, data };
    return {
      ok: false,
      error: typeof data.error === "string" ? data.error : "generic",
      issue: typeof data.issue === "string" ? data.issue : undefined,
    };
  } catch {
    return { ok: false, error: "generic" };
  }
}

/** Mensagem para os erros gerais das rotas de conta. */
export function accountErrorMessage(error: string, errors: PortalAccountDictionary["errors"]): string {
  if (error === "rate_limited") return errors.rateLimited;
  if (error === "unavailable") return errors.unavailable;
  if (error === "validation") return errors.invalidEmail;
  return errors.generic;
}

/**
 * Lê o token do link (`#token=…`) e o TIRA da barra de endereço: não fica no
 * histórico, num compartilhamento de tela ou num print. O fragmento nunca foi
 * ao servidor (ver `accountPageLink`).
 */
function takeTokenFromHash(): string | null {
  const match = /(?:^#|&)token=([A-Za-z0-9_-]+)/.exec(window.location.hash);
  if (window.location.hash) {
    window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
  }
  return match ? match[1] : null;
}

export type AccountLinkStatus = "checking" | "missing" | "valid" | "error" | AccountLinkFailure;

/**
 * Token do link aberto e o estado dele no servidor, conferido SEM consumir.
 * `missing` = página aberta sem link (ex.: "reenviar" a partir do login);
 * `error` = não deu para conferir agora (rede, limite de tentativas).
 */
export function useAccountLinkToken(purpose: "email_verification" | "password_reset") {
  // Ref: o StrictMode roda o efeito duas vezes, e na segunda o fragmento já saiu da URL.
  const tokenRef = useRef<string | null | undefined>(undefined);
  const [state, setState] = useState<{ status: AccountLinkStatus; token: string | null; error?: string }>({
    status: "checking",
    token: null,
  });

  useEffect(() => {
    if (tokenRef.current === undefined) tokenRef.current = takeTokenFromHash();
    const token = tokenRef.current;
    let cancelled = false;

    const check = token ? postAccount(ACCOUNT_API.token, { token, purpose }) : Promise.resolve(null);
    void check.then((result) => {
      if (cancelled) return;
      if (!token) return setState({ status: "missing", token: null });
      if (!result?.ok) return setState({ status: "error", token, error: result?.error });
      const linkState = result.data.state;
      setState({
        status: linkState === "valid" || linkState === "expired" || linkState === "used" ? linkState : "invalid",
        token,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [purpose]);

  /** Depois de uma ação no servidor que mostrou o link morto (vencido no meio do caminho). */
  function markFailed(status: AccountLinkFailure) {
    setState((current) => ({ ...current, status }));
  }

  return { ...state, markFailed };
}
