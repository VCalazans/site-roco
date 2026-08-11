/**
 * Máscara/validação de telefone BR — compartilhada entre o site público
 * (pré-cadastro de representantes) e o portal (onboarding). Fonte única:
 * `src/modules/portal/lib/phone.ts` re-exporta daqui para compatibilidade.
 */
export function formatPhoneBR(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) {
    return digits.length ? `(${digits}` : "";
  }
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** `true` para `(XX) XXXX-XXXX` (fixo) ou `(XX) XXXXX-XXXX` (celular). */
export function isValidPhoneBR(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11;
}
