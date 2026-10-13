"use client";

import { cn } from "@/core/lib/utils";
import type { Locale } from "@/i18n/config";
import type { TurnstileAction } from "@/shared/lib/turnstile";
import { TurnstileWidget } from "./turnstile-widget";
import type { TurnstileState } from "./use-turnstile";

/** Textos do formulário — os mesmos nomes das chaves `errors.*` dos dicionários. */
export type TurnstileFieldMessages = {
  /** Esperando o token: "Aguarde a verificação de segurança". */
  captchaPending: string;
  /** O desafio falhou no navegador. */
  captcha: string;
  /** O widget não carregou (script bloqueado, configuração). */
  captchaLoad: string;
};

type TurnstileFieldProps = {
  turnstile: TurnstileState;
  action: TurnstileAction;
  locale: Locale;
  /** Basta passar o `errors` do dicionário do formulário. */
  messages: TurnstileFieldMessages;
  className?: string;
};

/**
 * Verificação anti-robô dos formulários do SITE PÚBLICO (Tailwind, fundo
 * escuro): o widget e, logo abaixo, o motivo de o botão de enviar ainda estar
 * desabilitado. Sem site key no build não renderiza nada.
 */
export function TurnstileField({ turnstile, action, locale, messages, className }: TurnstileFieldProps) {
  if (!turnstile.enabled) return null;

  const status =
    turnstile.failure === "load"
      ? messages.captchaLoad
      : turnstile.failure === "challenge"
        ? messages.captcha
        : turnstile.pending
          ? messages.captchaPending
          : null;

  return (
    <div className={cn("mt-4", className)}>
      <TurnstileWidget action={action} locale={locale} theme="dark" {...turnstile.widget} />
      {status ? (
        <p
          role={turnstile.failure ? "alert" : "status"}
          className={cn("mt-2 text-micro", turnstile.failure ? "text-[#ff9b9b]" : "text-white/55")}
        >
          {status}
        </p>
      ) : null}
    </div>
  );
}
