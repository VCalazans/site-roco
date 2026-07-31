"use client";

import { useEffect, type RefObject } from "react";
import { formatCNPJ, isValidCNPJ } from "./cnpj";

/** Text (from the i18n dictionary) used by the field enhancements. */
export type EnhancementCopy = {
  cnpjInvalid: string;
  cnpjPlaceholder: string;
  phonePlaceholder: string;
};

// The Mautic form (id=1, alias "formulariodosite") injects these controls. We
// target by `name`, which is stable regardless of the form's numeric id.
const CNPJ_SELECTOR = 'input[name="mauticform[cnpj]"]';
const PHONE_SELECTOR = 'input[name="mauticform[telefone]"]';
const ERROR_MARKER = "data-cnpj-error";

/** Format a Brazilian phone as `(00) 0000-0000` / `(00) 00000-0000`. */
function formatPhoneBR(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function clearError(input: HTMLInputElement): void {
  input.setAttribute("aria-invalid", "false");
  input.parentElement?.querySelector(`[${ERROR_MARKER}]`)?.remove();
}

function showError(input: HTMLInputElement, message: string): void {
  input.setAttribute("aria-invalid", "true");
  let el = input.parentElement?.querySelector(`[${ERROR_MARKER}]`);
  if (!el && input.parentElement) {
    el = document.createElement("span");
    el.className = "mauticform-errormsg";
    el.setAttribute(ERROR_MARKER, "");
    input.parentElement.appendChild(el);
  }
  if (el) el.textContent = message;
}

/**
 * Progressively enhances the runtime-injected Mautic contact form: masks the
 * CNPJ and phone fields, validates the CNPJ (check digits) on blur, and blocks
 * submission of an invalid CNPJ before Mautic's own handler runs.
 *
 * The submit guard is registered on the container in the CAPTURE phase, so it
 * fires ahead of the listener Mautic attaches to the form itself — letting us
 * `preventDefault()` + `stopPropagation()` and keep the fake value from being
 * sent (both Mautic's AJAX and the native POST are cancelled). Inputs are wired
 * once (guarded by a data attribute) since the modal — and therefore the
 * injected form — stays mounted across open/close.
 *
 * Pure DOM (no React); returns a cleanup function. Exported for testing.
 */
export function enhanceMauticForm(
  container: HTMLElement,
  copy: EnhancementCopy,
): () => void {
  const { cnpjInvalid, cnpjPlaceholder, phonePlaceholder } = copy;

  const wireMask = (
    input: HTMLInputElement,
    format: (value: string) => string,
    placeholder: string,
  ) => {
    if (input.dataset.enhanced === "true") return;
    input.dataset.enhanced = "true";
    if (placeholder && !input.placeholder) input.placeholder = placeholder;
    input.addEventListener("input", () => {
      input.value = format(input.value);
      clearError(input);
    });
  };

  const wireFields = (): boolean => {
    const cnpj = container.querySelector<HTMLInputElement>(CNPJ_SELECTOR);
    if (!cnpj) return false;

    wireMask(cnpj, formatCNPJ, cnpjPlaceholder);
    if (cnpj.dataset.blurWired !== "true") {
      cnpj.dataset.blurWired = "true";
      cnpj.addEventListener("blur", () => {
        const value = cnpj.value.trim();
        if (value && !isValidCNPJ(value)) showError(cnpj, cnpjInvalid);
        else clearError(cnpj);
      });
    }

    const phone = container.querySelector<HTMLInputElement>(PHONE_SELECTOR);
    if (phone) wireMask(phone, formatPhoneBR, phonePlaceholder);
    return true;
  };

  const onSubmitCapture = (event: Event) => {
    const form = event.target as HTMLElement | null;
    if (!form) return;
    const cnpj = form.querySelector<HTMLInputElement>(CNPJ_SELECTOR);
    if (!cnpj) return;
    const value = cnpj.value.trim();
    if (value && !isValidCNPJ(value)) {
      event.preventDefault();
      event.stopPropagation();
      showError(cnpj, cnpjInvalid);
      cnpj.focus();
    }
  };
  container.addEventListener("submit", onSubmitCapture, true);

  let observer: MutationObserver | undefined;
  if (!wireFields()) {
    observer = new MutationObserver(() => {
      if (wireFields()) observer?.disconnect();
    });
    observer.observe(container, { childList: true, subtree: true });
  }

  return () => {
    container.removeEventListener("submit", onSubmitCapture, true);
    observer?.disconnect();
  };
}

/** React binding: enhances the form while it is active (mounted and visible). */
export function useMauticEnhancements(
  containerRef: RefObject<HTMLDivElement | null>,
  active: boolean,
  copy: EnhancementCopy,
): void {
  const { cnpjInvalid, cnpjPlaceholder, phonePlaceholder } = copy;

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;
    return enhanceMauticForm(container, {
      cnpjInvalid,
      cnpjPlaceholder,
      phonePlaceholder,
    });
  }, [active, containerRef, cnpjInvalid, cnpjPlaceholder, phonePlaceholder]);
}
