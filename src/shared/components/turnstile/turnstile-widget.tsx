"use client";

import { useEffect, useEffectEvent, useImperativeHandle, useRef, type Ref } from "react";
import type { Locale } from "@/i18n/config";
import { getTurnstileSiteKey, type TurnstileAction } from "@/shared/lib/turnstile";

/**
 * Script da Cloudflare em modo de renderização explícita (o widget só aparece
 * quando chamamos `turnstile.render`). Tem de vir desta URL exata — a
 * Cloudflare avisa que cópia ou proxy do `api.js` quebra nas atualizações —,
 * e o host está liberado em `script-src`/`frame-src` na CSP (`next.config.ts`).
 */
const TURNSTILE_SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** Largura mínima do tamanho `flexible`; abaixo dela o widget estouraria a coluna. */
const FLEXIBLE_MIN_WIDTH_PX = 300;

/** Idioma do widget pelo idioma da página (códigos da Cloudflare). */
const WIDGET_LANGUAGE: Record<Locale, string> = { pt: "pt-br", en: "en" };

/**
 * Erros do widget que não se resolvem tentando de novo: site key inválida ou
 * inexistente, domínio fora da lista da chave (110100/110110/110200/400020) e
 * iframe que não carregou — `challenges.cloudflare.com` bloqueado (200500).
 * Os demais (desafio que falhou, tempo esgotado) o próprio Turnstile repete.
 */
const LOAD_ERROR_CODES = new Set(["110100", "110110", "110200", "400020", "200500"]);

// Tipos da API global do Turnstile — só o que este projeto usa.
type TurnstileRenderOptions = {
  sitekey: string;
  action: string;
  language: string;
  theme: TurnstileTheme;
  size: "flexible" | "compact";
  /** `false`: o token não vai num `<input>` criado pelo widget — cada formulário o envia. */
  "response-field": boolean;
  callback: (token: string) => void;
  "expired-callback": () => void;
  "timeout-callback": () => void;
  "error-callback": (errorCode: string | number) => boolean;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string | null | undefined;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export type TurnstileTheme = "dark" | "light" | "auto";

/** `load`: o widget não tem como funcionar (script ou configuração); `challenge`: o desafio falhou. */
export type TurnstileFailure = "load" | "challenge";

export type TurnstileWidgetHandle = {
  /** Pede um token novo (o anterior é de uso único e foi gasto no envio). */
  reset: () => void;
};

let scriptPromise: Promise<TurnstileApi> | null = null;

/**
 * Carrega o `api.js` UMA vez por página, por mais widgets que existam: todos
 * esperam a mesma promessa. Se o carregamento falhar (rede, bloqueio), a
 * promessa é descartada e o `<script>` morto sai — a próxima montagem tenta de
 * novo.
 */
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    const fail = () => {
      scriptPromise = null;
      script.remove();
      reject(new Error("turnstile-script-load"));
    };
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.addEventListener("load", () => (window.turnstile ? resolve(window.turnstile) : fail()));
    script.addEventListener("error", fail);
    document.head.appendChild(script);
  });
  return scriptPromise;
}

type TurnstileWidgetProps = {
  /** Ação do formulário (`TURNSTILE_ACTIONS`) — o servidor confere a mesma. */
  action: TurnstileAction;
  /** Idioma da página — o widget fala o mesmo idioma. */
  locale: Locale;
  /** `dark` no site público (fundo escuro); `auto` no portal (tema claro/escuro). */
  theme: TurnstileTheme;
  /** Token novo, ou `null` quando o anterior venceu/falhou. */
  onTokenChange: (token: string | null) => void;
  onFailure?: (failure: TurnstileFailure) => void;
  ref?: Ref<TurnstileWidgetHandle>;
};

/**
 * Widget do Cloudflare Turnstile (verificação anti-robô). Sem
 * `NEXT_PUBLIC_TURNSTILE_SITE_KEY` no build não renderiza nada — e o servidor,
 * sem `TURNSTILE_SECRET_KEY`, não exige token (ver `@/server/lib/turnstile`).
 *
 * O formulário guarda o token (`onTokenChange`), manda no corpo e chama
 * `reset()` depois de TODA tentativa de envio: o token é de uso único. Sem
 * estilo próprio (o mesmo componente serve o site em Tailwind e o portal em
 * MUI) — só reserva a altura do widget para a página não pular.
 */
export function TurnstileWidget({ action, locale, theme, onTokenChange, onFailure, ref }: TurnstileWidgetProps) {
  const siteKey = getTurnstileSiteKey();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  // Chamados pelos callbacks do Turnstile, que vivem fora do React: sempre a
  // versão mais recente dos handlers, sem recriar o widget a cada render.
  const emitToken = useEffectEvent((token: string | null) => onTokenChange(token));
  const emitFailure = useEffectEvent((failure: TurnstileFailure) => onFailure?.(failure));

  useImperativeHandle(
    ref,
    () => ({
      reset() {
        const widgetId = widgetIdRef.current;
        if (!widgetId) return;
        try {
          window.turnstile?.reset(widgetId);
        } catch {
          // Widget já removido (a tela trocou no meio do envio): nada a resetar.
        }
      },
    }),
    []
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!siteKey || !container) return;
    let cancelled = false;

    loadTurnstile().then(
      (turnstile) => {
        if (cancelled) return;
        try {
          const widgetId = turnstile.render(container, {
            sitekey: siteKey,
            action,
            language: WIDGET_LANGUAGE[locale],
            theme,
            // `flexible` ocupa a largura da coluna, mas tem mínimo de 300 px:
            // coluna mais estreita (celular; o cartão do portal num celular
            // de 375 px tem ~260 px) usa o `compact` em vez de estourar a tela.
            size: container.clientWidth < FLEXIBLE_MIN_WIDTH_PX ? "compact" : "flexible",
            "response-field": false,
            callback: (token) => emitToken(token),
            // Token vencido (5 min) ou desafio interativo não concluído: o
            // Turnstile renova sozinho; até lá não há token válido.
            "expired-callback": () => emitToken(null),
            "timeout-callback": () => emitToken(null),
            "error-callback": (errorCode) => {
              emitToken(null);
              emitFailure(LOAD_ERROR_CODES.has(String(errorCode)) ? "load" : "challenge");
              // `false`: o Turnstile segue com as novas tentativas automáticas.
              return false;
            },
          });
          if (widgetId) widgetIdRef.current = widgetId;
          else emitFailure("load");
        } catch {
          emitFailure("load");
        }
      },
      () => {
        if (!cancelled) emitFailure("load");
      }
    );

    return () => {
      cancelled = true;
      const widgetId = widgetIdRef.current;
      widgetIdRef.current = null;
      if (!widgetId) return;
      try {
        window.turnstile?.remove(widgetId);
      } catch {
        // Já removido.
      }
    };
  }, [siteKey, action, locale, theme]);

  if (!siteKey) return null;
  return <div ref={containerRef} style={{ width: "100%", minHeight: 65 }} />;
}
