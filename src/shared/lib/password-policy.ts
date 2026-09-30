/**
 * Política de senha das contas do portal — a MESMA no navegador (pré-cadastro
 * e redefinição de senha) e no servidor, que revalida tudo.
 *
 * Segue a NIST SP 800-63B: comprimento mínimo, sem regra de composição
 * ("uma maiúscula, um número…" só produz "Senha123!"), recusa das senhas mais
 * óbvias e teto de 72 BYTES — o bcrypt ignora o que passa disso, então o
 * resto de uma senha maior não protegeria nada e daria falsa segurança.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72;

export type PasswordIssue = "too_short" | "too_long" | "too_common" | "contains_email";

/** As mais usadas (pt/en) e as óbvias para este portal — comparadas sem caixa. */
const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "passw0rd",
  "senha123",
  "senha1234",
  "senha12345",
  "minhasenha",
  "qwerty123",
  "qwertyuiop",
  "asdfghjk",
  "abc12345",
  "abcd1234",
  "iloveyou",
  "admin123",
  "admin1234",
  "changeme",
  "mudar123",
  "trocar123",
  "brasil123",
  "roco1234",
  "roco2026",
  "portalroco",
  "representante",
]);

/** "12345678", "87654321", "abcdefgh": cada caractere é o vizinho do anterior. */
function isSimpleSequence(value: string): boolean {
  if (!/^[a-z]+$|^[0-9]+$/.test(value)) return false;
  const step = value.charCodeAt(1) - value.charCodeAt(0);
  if (step !== 1 && step !== -1) return false;
  for (let index = 2; index < value.length; index += 1) {
    if (value.charCodeAt(index) - value.charCodeAt(index - 1) !== step) return false;
  }
  return true;
}

/**
 * O que a senha não pode conter do e-mail da conta: o nome inteiro (antes do
 * "@") e cada pedaço dele separado por ".", "_", "-" ou "+" — em
 * "joao.silva@…", nem "joao.silva", nem "joao", nem "silva". Pedaços com
 * menos de 4 letras ficam de fora ("jr", "ti"): barrariam senhas boas.
 */
function emailWords(email: string | undefined): string[] {
  const mailbox = email?.trim().toLowerCase().split("@")[0] ?? "";
  const words = new Set([mailbox, ...mailbox.split(/[._+-]+/)]);
  return [...words].filter((word) => word.length >= 4);
}

/**
 * Primeiro problema encontrado na senha, ou `null` se ela é aceitável.
 * `email` é o da própria conta: a senha não pode conter o nome dela.
 */
export function checkPassword(password: string, context: { email?: string } = {}): PasswordIssue | null {
  if (Array.from(password).length < PASSWORD_MIN_LENGTH) return "too_short";
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) return "too_long";

  const normalized = password.toLowerCase();
  if (COMMON_PASSWORDS.has(normalized) || /^(.)\1+$/.test(normalized) || isSimpleSequence(normalized)) {
    return "too_common";
  }

  if (emailWords(context.email).some((word) => normalized.includes(word))) return "contains_email";

  return null;
}
