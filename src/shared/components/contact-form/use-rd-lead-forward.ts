"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Encaminha ao RD Station o lead que o formulário do Mautic acabou de aceitar.
 *
 * O formulário continua sendo o do Mautic, sem mudança no seu envio: este hook
 * apenas OBSERVA. Quando o Mautic confirma o sucesso, os valores capturados são
 * enviados a `POST /api/rd-lead`, que fala com o RD do lado do servidor (a
 * chave de API não pode ir ao navegador).
 *
 * POR QUE CAPTURAR NO SUBMIT, E NÃO NO SUCESSO: o SDK do Mautic limpa os campos
 * ao concluir. Ler o formulário dentro do callback de sucesso devolveria
 * strings vazias de forma intermitente — dependeria de ganhar uma corrida
 * contra o reset. Então os valores são lidos na fase de CAPTURA do `submit`,
 * antes de qualquer coisa acontecer, e guardados numa ref até a confirmação.
 *
 * DETECÇÃO DE SUCESSO: mesma dupla de sinais já usada por `useCatalogDownload`
 * — o callback `onResponseEnd` do SDK e, como reserva, a classe
 * `mauticform-post-success` no wrapper. O callback anterior é ENCADEADO e
 * restaurado no cleanup: dois hooks podem observar o mesmo formulário (a página
 * de catálogo usa os dois) e nenhum pode apagar o outro.
 */

type MauticResponse = { success?: unknown };
type CallbackSlot = Record<string, ((data: MauticResponse) => unknown) | undefined>;
type MauticWindow = Window & {
  MauticFormCallback?: Record<string, CallbackSlot | undefined>;
};

const SUCCESS_CLASS = "mauticform-post-success";

/** Campos do formulário do Mautic → campos do lead enviado ao RD. */
const FIELD_MAP = {
  nome: "nome",
  sobrenome: "sobrenome",
  email: "email",
  telefone: "telefone",
  cnpj: "cnpj",
  cidade: "cidade",
  estado: "estado",
  mensagem: "mensagem",
} as const;

type CapturedFields = Partial<Record<keyof typeof FIELD_MAP, string>>;

type UseRdLeadForwardOptions = {
  formAlias: string;
  containerRef: RefObject<HTMLElement | null>;
  /** Define o `conversion_identifier` do lado do servidor. */
  subject: "catalog" | "general";
  /** Seção que originou o formulário — vira `cf_origem` no RD. */
  origin?: "catalogo" | "menu" | "home";
};

function readFields(container: HTMLElement | null, alias: string): CapturedFields {
  if (!container) return {};
  const captured: CapturedFields = {};

  for (const key of Object.keys(FIELD_MAP) as (keyof typeof FIELD_MAP)[]) {
    const field = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      `#mauticform_input_${alias}_${FIELD_MAP[key]}`
    );
    const value = field?.value?.trim();
    if (value) captured[key] = value;
  }

  return captured;
}

export function useRdLeadForward({
  formAlias,
  containerRef,
  subject,
  origin,
}: UseRdLeadForwardOptions) {
  const captured = useRef<CapturedFields>({});
  const forwarded = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onSubmitCapture = () => {
      captured.current = readFields(container, formAlias);
      forwarded.current = false;
    };
    // Fase de CAPTURA: roda antes do handler do SDK, que é quem inicia o AJAX.
    container.addEventListener("submit", onSubmitCapture, true);

    const forward = () => {
      if (forwarded.current) return;
      const fields = captured.current;
      // Sem nome ou e-mail não há lead a encaminhar — o servidor recusaria.
      if (!fields.nome || !fields.email) return;
      forwarded.current = true;

      const fullName = [fields.nome, fields.sobrenome].filter(Boolean).join(" ");

      // `keepalive`: o envio sobrevive se a página navegar logo em seguida
      // (o download do catálogo dispara junto com o sucesso).
      void fetch("/api/rd-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          name: fullName,
          email: fields.email,
          phone: fields.telefone,
          city: fields.cidade,
          state: fields.estado,
          cnpj: fields.cnpj,
          message: fields.mensagem,
          subject,
          origin,
        }),
        // Falha aqui é silenciosa por desenho: o lead já está no Mautic e o
        // visitante não deve ver erro por causa de um canal secundário.
      }).catch(() => {});
    };

    const mauticWindow = window as MauticWindow;
    const registry = (mauticWindow.MauticFormCallback ??= {});
    const slot = (registry[formAlias] ??= {});
    const previous = slot.onResponseEnd;

    const handler = (response: MauticResponse) => {
      const result = previous?.(response);
      if (response?.success) forward();
      return result;
    };
    slot.onResponseEnd = handler;

    const wrapper = container.querySelector(`#mauticform_wrapper_${formAlias}`);
    let observer: MutationObserver | undefined;
    if (wrapper) {
      observer = new MutationObserver(() => {
        if (wrapper.classList.contains(SUCCESS_CLASS)) forward();
      });
      observer.observe(wrapper, { attributes: true, attributeFilter: ["class"] });
    }

    return () => {
      container.removeEventListener("submit", onSubmitCapture, true);
      // Só desfaz o PRÓPRIO handler — outra montagem pode tê-lo substituído.
      if (slot.onResponseEnd === handler) slot.onResponseEnd = previous;
      observer?.disconnect();
    };
  }, [formAlias, containerRef, subject, origin]);
}
