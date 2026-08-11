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
import { isValidCNPJ } from "@/shared/components/contact-form/cnpj";
import { isValidPhoneBR } from "@/shared/lib/phone";

export const REGISTER_PASSWORD_MIN = 8;

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(200),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .max(320),
  phone: z
    .string()
    .trim()
    .min(1)
    .max(30)
    .refine(isValidPhoneBR, { message: "invalid_phone" }),
  companyName: z.string().trim().min(2).max(200),
  cnpj: z
    .string()
    .trim()
    .min(1)
    .max(18)
    .refine(isValidCNPJ, { message: "invalid_cnpj" }),
  password: z.string().min(REGISTER_PASSWORD_MIN).max(100),
});

/**
 * Honeypot anti-bot: nome do campo invisível no form público. A rota checa
 * ANTES do parse — preenchido = bot, e a resposta é um sucesso silencioso
 * (nada é gravado, e o bot não recebe dica de que foi detectado).
 */
export const HONEYPOT_FIELD = "website";

export type RegisterInput = z.infer<typeof registerSchema>;
