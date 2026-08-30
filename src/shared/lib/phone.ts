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

/**
 * Formata para EXIBIÇÃO um telefone que pode chegar com DDI, como o
 * `contact.phone` de `site_settings` — que é gravado no formato do link do
 * WhatsApp (`554733352012`, 12 dígitos) e por isso saía cru no rodapé.
 *
 * `formatPhoneBR` NÃO serve aqui: ele corta em 11 dígitos, então
 * "554733352012" viraria "(55) 47333-5201" — um número que não existe.
 *
 * Só reformata o que reconhece (10 ou 11 dígitos nacionais, com ou sem o
 * "55" na frente). Qualquer outro formato volta como veio: é um campo que o
 * admin edita à mão, e inventar máscara sobre entrada desconhecida é pior
 * do que mostrar o que ele escreveu.
 */
export function formatPhoneDisplayBR(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return value.trim();
  const national =
    digits.length > 11 && digits.startsWith("55") ? digits.slice(2) : digits;
  // DDD brasileiro nunca começa com zero — o guard existe para não transformar
  // um 0800 (que também tem 11 dígitos) em "(08) 00123-4567".
  const isNationalNumber =
    (national.length === 10 || national.length === 11) && !national.startsWith("0");
  return isNationalNumber ? formatPhoneBR(national) : value.trim();
}
