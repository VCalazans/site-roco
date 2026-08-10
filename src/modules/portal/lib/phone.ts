/**
 * Máscara/validação de telefone BR — pequena função própria (não reaproveita
 * `formatPhoneBR` de `src/shared/components/contact-form/use-mautic-enhancements.ts`
 * porque não é exportada por aquele módulo, e este agente não pode editar
 * `src/shared/**`). Mesma lógica (fixo 8 dígitos / celular 9 dígitos).
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
