"use client";

import { useEffect, useRef } from "react";
import { useMauticEnhancements, type EnhancementCopy } from "./use-mautic-enhancements";

/**
 * Static, self-hosted embed of the ROCO Mautic form (id=1, "formulariodosite").
 *
 * SECURITY (incidente ClickFix — 2026-07): em vez de baixar o script gerado
 * dinamicamente (`generate.js?id=1`) do servidor Mautic — que estava servindo JS
 * malicioso — esta versão:
 *   1. Renderiza o HTML do formulário de forma ESTÁTICA (controlado neste repo);
 *   2. Carrega o SDK do Mautic (`mautic-form.js`) de uma cópia VERIFICADA e
 *      self-hosted em `/vendor/mautic-form.js` (nenhum JS de runtime vem do host
 *      potencialmente comprometido);
 *   3. Só o POST de envio vai para o Mautic (dado saindo, não código executável).
 *
 * Combinado com a CSP em `next.config.ts` (`script-src 'self'`), mesmo uma
 * reinfecção do servidor Mautic não consegue injetar/carregar script no site.
 *
 * Rollback para o embed original: ver `docs/ROLLBACK-mautic-embed.md`.
 */

/** Rótulos e mensagens do formulário (do dicionário i18n). */
export type MauticFormCopy = {
  nome: string;
  sobrenome: string;
  telefone: string;
  email: string;
  cnpj: string;
  cidade: string;
  estado: string;
  mensagem: string;
  captcha: string;
  submit: string;
  submitting: string;
  errors: {
    nome: string;
    sobrenome: string;
    telefone: string;
    email: string;
    cnpj: string;
    cidade: string;
    estado: string;
    captcha: string;
  };
};

type MauticEmbedProps = {
  isOpen: boolean;
  content: MauticFormCopy;
  enhancement: EnhancementCopy;
};

// Domínio do Mautic — usado pelo SDK para o AJAX de submit e pela `action` do form.
// Apenas o POST de dados vai para cá; nenhum script executável é carregado dele.
const MAUTIC_DOMAIN = "https://mautic.roco.com.br/index.php";
const MAUTIC_ACTION = "https://mautic.roco.com.br/form/submit?formId=1";
// Cópia verificada e self-hosted do SDK do Mautic (ver public/vendor/README.md).
const MAUTIC_SDK_SRC = "/vendor/mautic-form.js";

type MauticGlobal = Window & {
  MauticSDK?: { onLoad: () => void };
  MauticDomain?: string;
  MauticLang?: Record<string, string>;
};

const hidden = { display: "none" } as const;

export function MauticEmbed({ isOpen, content, enhancement }: MauticEmbedProps) {
  const formRef = useRef<HTMLDivElement>(null);
  const loaded = useRef(false);

  // Máscara + validação de CNPJ (mesma lógica do embed original).
  useMauticEnhancements(formRef, isOpen, enhancement);

  // Carrega o SDK self-hosted na primeira vez que o modal abre e inicializa o form.
  useEffect(() => {
    if (!isOpen || loaded.current) return;
    loaded.current = true;

    const w = window as MauticGlobal;
    w.MauticDomain = MAUTIC_DOMAIN;
    w.MauticLang = { submittingMessage: content.submitting };

    if (typeof w.MauticSDK !== "undefined") {
      w.MauticSDK.onLoad();
      return;
    }

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = MAUTIC_SDK_SRC;
    script.async = true;
    script.onload = () => (window as MauticGlobal).MauticSDK?.onLoad();
    document.head.appendChild(script);
  }, [isOpen, content.submitting]);

  const e = content.errors;

  return (
    <div ref={formRef} className="mautic-form-wrap">
      <div id="mauticform_wrapper_formulariodosite" className="mauticform_wrapper">
        <form
          autoComplete="off"
          role="form"
          method="post"
          action={MAUTIC_ACTION}
          id="mauticform_formulariodosite"
          data-mautic-form="formulariodosite"
          encType="multipart/form-data"
        >
          <div className="mauticform-error" id="mauticform_formulariodosite_error" />
          <div className="mauticform-message" id="mauticform_formulariodosite_message" />

          <div className="mauticform-innerform">
            <div className="mauticform-page-wrapper mauticform-page-1" data-mautic-form-page="1">
              <div
                id="mauticform_formulariodosite_nome"
                data-validate="nome"
                data-validation-type="text"
                className="mauticform-row mauticform-text mauticform-field-1 mauticform-required"
              >
                <label htmlFor="mauticform_input_formulariodosite_nome" className="mauticform-label">
                  {content.nome}
                </label>
                <input
                  id="mauticform_input_formulariodosite_nome"
                  name="mauticform[nome]"
                  className="mauticform-input"
                  type="text"
                />
                <span className="mauticform-errormsg" style={hidden}>
                  {e.nome}
                </span>
              </div>

              <div
                id="mauticform_formulariodosite_sobrenome"
                data-validate="sobrenome"
                data-validation-type="text"
                className="mauticform-row mauticform-text mauticform-field-2 mauticform-required"
              >
                <label htmlFor="mauticform_input_formulariodosite_sobrenome" className="mauticform-label">
                  {content.sobrenome}
                </label>
                <input
                  id="mauticform_input_formulariodosite_sobrenome"
                  name="mauticform[sobrenome]"
                  className="mauticform-input"
                  type="text"
                />
                <span className="mauticform-errormsg" style={hidden}>
                  {e.sobrenome}
                </span>
              </div>

              <div
                id="mauticform_formulariodosite_telefone"
                data-validate="telefone"
                data-validation-type="tel"
                className="mauticform-row mauticform-tel mauticform-field-3 mauticform-required"
              >
                <label htmlFor="mauticform_input_formulariodosite_telefone" className="mauticform-label">
                  {content.telefone}
                </label>
                <input
                  id="mauticform_input_formulariodosite_telefone"
                  name="mauticform[telefone]"
                  className="mauticform-input"
                  type="tel"
                />
                <span className="mauticform-errormsg" style={hidden}>
                  {e.telefone}
                </span>
              </div>

              <div
                id="mauticform_formulariodosite_email"
                data-validate="email"
                data-validation-type="email"
                className="mauticform-row mauticform-email mauticform-field-4 mauticform-required"
              >
                <label htmlFor="mauticform_input_formulariodosite_email" className="mauticform-label">
                  {content.email}
                </label>
                <input
                  id="mauticform_input_formulariodosite_email"
                  name="mauticform[email]"
                  className="mauticform-input"
                  type="email"
                />
                <span className="mauticform-errormsg" style={hidden}>
                  {e.email}
                </span>
              </div>

              <div
                id="mauticform_formulariodosite_cnpj"
                data-validate="cnpj"
                data-validation-type="text"
                className="mauticform-row mauticform-text mauticform-field-5 mauticform-required"
              >
                <label htmlFor="mauticform_input_formulariodosite_cnpj" className="mauticform-label">
                  {content.cnpj}
                </label>
                <input
                  id="mauticform_input_formulariodosite_cnpj"
                  name="mauticform[cnpj]"
                  className="mauticform-input"
                  type="text"
                />
                <span className="mauticform-errormsg" style={hidden}>
                  {e.cnpj}
                </span>
              </div>

              <div
                id="mauticform_formulariodosite_cidade"
                data-validate="cidade"
                data-validation-type="text"
                className="mauticform-row mauticform-text mauticform-field-6 mauticform-required"
              >
                <label htmlFor="mauticform_input_formulariodosite_cidade" className="mauticform-label">
                  {content.cidade}
                </label>
                <input
                  id="mauticform_input_formulariodosite_cidade"
                  name="mauticform[cidade]"
                  className="mauticform-input"
                  type="text"
                />
                <span className="mauticform-errormsg" style={hidden}>
                  {e.cidade}
                </span>
              </div>

              <div
                id="mauticform_formulariodosite_estado"
                data-validate="estado"
                data-validation-type="text"
                className="mauticform-row mauticform-text mauticform-field-7 mauticform-required"
              >
                <label htmlFor="mauticform_input_formulariodosite_estado" className="mauticform-label">
                  {content.estado}
                </label>
                <input
                  id="mauticform_input_formulariodosite_estado"
                  name="mauticform[estado]"
                  className="mauticform-input"
                  type="text"
                />
                <span className="mauticform-errormsg" style={hidden}>
                  {e.estado}
                </span>
              </div>

              <div
                id="mauticform_formulariodosite_mensagem"
                className="mauticform-row mauticform-text mauticform-field-8"
              >
                <label htmlFor="mauticform_input_formulariodosite_mensagem" className="mauticform-label">
                  {content.mensagem}
                </label>
                <textarea
                  id="mauticform_input_formulariodosite_mensagem"
                  name="mauticform[mensagem]"
                  className="mauticform-textarea"
                />
                <span className="mauticform-errormsg" style={hidden} />
              </div>

              <div
                id="mauticform_formulariodosite_quanto_e_27__25"
                data-validate="quanto_e_27__25"
                data-validation-type="captcha"
                className="mauticform-row mauticform-text mauticform-field-9 mauticform-required"
              >
                <label htmlFor="mauticform_input_formulariodosite_quanto_e_27__25" className="mauticform-label">
                  {content.captcha}
                </label>
                <input
                  id="mauticform_input_formulariodosite_quanto_e_27__25"
                  name="mauticform[quanto_e_27__25]"
                  className="mauticform-input"
                  type="text"
                />
                <span className="mauticform-errormsg" style={hidden}>
                  {e.captcha}
                </span>
              </div>

              <div
                id="mauticform_formulariodosite_submit"
                className="mauticform-row mauticform-button-wrapper mauticform-field-10"
              >
                <button
                  type="submit"
                  name="mauticform[submit]"
                  id="mauticform_input_formulariodosite_submit"
                  value=""
                  className="mauticform-button btn btn-default"
                >
                  {content.submit}
                </button>
              </div>
            </div>
          </div>

          <input type="hidden" name="mauticform[formId]" id="mauticform_formulariodosite_id" defaultValue="1" />
          <input type="hidden" name="mauticform[return]" id="mauticform_formulariodosite_return" defaultValue="" />
          <input
            type="hidden"
            name="mauticform[formName]"
            id="mauticform_formulariodosite_name"
            defaultValue="formulariodosite"
          />
        </form>
      </div>
    </div>
  );
}
