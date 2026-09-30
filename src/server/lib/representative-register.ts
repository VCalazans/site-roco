/**
 * Schema do pré-cadastro público de representantes (`POST
 * /api/representatives/register`). Vive em lib própria — sem `server-only` e
 * sem tocar banco — para ser testável no Vitest e reutilizável pela validação
 * client-side da página `/representantes`.
 *
 * Regra de negócio: o CNPJ é OBRIGATÓRIO no pré-cadastro (diferente do
 * rascunho do onboarding, onde os campos vão sendo preenchidos aos poucos).
 */
import { z } from "zod";
import { locales } from "@/i18n/config";
import { isValidCNPJ } from "@/shared/components/contact-form/cnpj";
import { checkPassword, PASSWORD_MIN_LENGTH } from "@/shared/lib/password-policy";
import { isValidPhoneBR } from "@/shared/lib/phone";

/** Política de senha compartilhada (`@/shared/lib/password-policy`). */
export const REGISTER_PASSWORD_MIN = PASSWORD_MIN_LENGTH;

/** Teto do nome no pré-cadastro — sobra para nomes compostos longos. */
export const PERSON_NAME_MAX = 120;

/** Espaços repetidos (inclusive quebras de linha) viram um só. */
export function normalizePersonName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * Nome de pessoa: letras (com acento), espaço, apóstrofo, ponto e hífen, de 2 a
 * 120 caracteres. O nome vai para a saudação dos e-mails da ROCO — sem dígitos,
 * `@`, `/` e `:`, o formulário público não serve para mandar telefone, link ou
 * endereço com a marca da ROCO a quem não pediu (revisão de segurança 2026-09-30).
 */
export function isValidPersonName(value: string): boolean {
  const name = normalizePersonName(value);
  return name.length >= 2 && name.length <= PERSON_NAME_MAX && /^[\p{L}\p{M}][\p{L}\p{M} '’.-]*$/u.test(name);
}

export const registerSchema = z
  .object({
    name: z.string().max(400).transform(normalizePersonName).refine(isValidPersonName, { message: "invalid_name" }),
    email: z.string().trim().toLowerCase().email().max(320),
    phone: z.string().trim().min(1).max(30).refine(isValidPhoneBR, { message: "invalid_phone" }),
    companyName: z.string().trim().min(2).max(200),
    cnpj: z.string().trim().min(1).max(18).refine(isValidCNPJ, { message: "invalid_cnpj" }),
    password: z.string().max(200),
    /** Idioma da página: o e-mail de confirmação sai nele. */
    locale: z.enum(locales).optional(),
  })
  // A política precisa do e-mail (a senha não pode conter o nome dele).
  .superRefine((data, context) => {
    const issue = checkPassword(data.password, { email: data.email });
    if (issue) context.addIssue({ code: "custom", path: ["password"], message: issue });
  });

/**
 * Honeypot anti-bot: nome do campo invisível no form público. A rota checa
 * ANTES do parse — preenchido = bot, e a resposta é um sucesso silencioso
 * (nada é gravado, e o bot não recebe dica de que foi detectado).
 */
export const HONEYPOT_FIELD = "website";

export type RegisterInput = z.infer<typeof registerSchema>;

/** Conta que já usa o CNPJ de um novo pré-cadastro, como a rota a encontra no banco. */
export interface ExistingRegistration {
  emailVerified: boolean;
  hasPassword: boolean;
  hasOAuthAccount: boolean;
  hasRoles: boolean;
  status: string;
  submitted: boolean;
}

/**
 * Pré-cadastro do site que ainda não confirmou o e-mail: e-mail não
 * confirmado, conta só com senha (sem login social), sem perfil e ainda em
 * rascunho. Uma conta assim nunca entrou no portal (o login por senha exige o
 * e-mail confirmado) e NÃO segura o CNPJ: um novo pré-cadastro com o mesmo CNPJ
 * é criado ao lado dele — nenhum apaga o outro, e o primeiro a confirmar o
 * e-mail entra na fila (ver `applyEmailVerified`). Sem isso, um e-mail
 * digitado errado prenderia o CNPJ: o link nunca chega, e o cadastro com o
 * e-mail certo esbarraria em "CNPJ já cadastrado". Os que nunca confirmam são
 * apagados depois de alguns dias (`purgeStaleAccountData`).
 *
 * O e-mail repetido NÃO segue esta regra (continua 409): outro cadastro com o
 * mesmo e-mail trocaria a senha de quem ainda vai clicar no link.
 */
export function isUnconfirmedPreRegistration(existing: ExistingRegistration): boolean {
  return (
    !existing.emailVerified &&
    existing.hasPassword &&
    !existing.hasOAuthAccount &&
    !existing.hasRoles &&
    existing.status === "draft" &&
    !existing.submitted
  );
}
