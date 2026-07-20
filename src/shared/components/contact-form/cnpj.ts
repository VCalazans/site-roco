/**
 * CNPJ helpers — masking and check-digit validation.
 *
 * Supports both the classic all-numeric CNPJ and the alphanumeric CNPJ that
 * Brazil's Receita Federal began issuing in July/2026: the 12-character base may
 * contain A–Z and 0–9, while the two check digits stay numeric. The check digits
 * use the official mod-11 algorithm where each character contributes its value
 * as `charCode − 48` ('0'→0 … '9'→9, 'A'→17 … 'Z'→42), which is fully backward
 * compatible with numeric CNPJs.
 */

/** Uppercase, strip mask/invalid chars, cap at 14 characters. */
export function cleanCNPJ(value: string): string {
  return value.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 14);
}

/** Apply the CNPJ mask progressively: `AA.AAA.AAA/AAAA-DD`. */
export function formatCNPJ(value: string): string {
  const c = cleanCNPJ(value);
  let out = c.slice(0, 2);
  if (c.length > 2) out += "." + c.slice(2, 5);
  if (c.length > 5) out += "." + c.slice(5, 8);
  if (c.length > 8) out += "/" + c.slice(8, 12);
  if (c.length > 12) out += "-" + c.slice(12, 14);
  return out;
}

const WEIGHTS_FIRST = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const WEIGHTS_SECOND = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/** Character value used by the check-digit sum ('0'→0 … 'Z'→42). */
function charValue(ch: string): number {
  return ch.charCodeAt(0) - 48;
}

function checkDigit(base: string, weights: number[]): number {
  const sum = weights.reduce((acc, weight, i) => acc + charValue(base[i]) * weight, 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

/**
 * True when `value` is a structurally valid CNPJ (numeric or alphanumeric).
 * Rejects wrong length, non-numeric check digits and repeated-character strings
 * (e.g. `00.000.000/0000-00`), which pass the raw math but are never real.
 */
export function isValidCNPJ(value: string): boolean {
  const c = cleanCNPJ(value);
  if (c.length !== 14) return false;
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(c)) return false;
  if (/^(.)\1{13}$/.test(c)) return false;

  const first = checkDigit(c.slice(0, 12), WEIGHTS_FIRST);
  const second = checkDigit(c.slice(0, 13), WEIGHTS_SECOND);
  return first === Number(c[12]) && second === Number(c[13]);
}
