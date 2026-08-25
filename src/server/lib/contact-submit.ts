/**
 * Schema do formulário de contato público (`POST /api/contact`). Vive em lib
 * própria — sem `server-only` e sem tocar banco — para ser testável no
 * Vitest e reutilizável pela validação client-side da página `/contato`.
 * Espelha o padrão de `src/server/lib/representative-register.ts`.
 *
 * Regra de negócio: diferente do pré-cadastro de representante (CNPJ
 * obrigatório), aqui CNPJ é OPCIONAL — o formulário atende tanto pessoa
 * física quanto empresa. Quando preenchido, ainda assim precisa ser
 * estruturalmente válido (mesmo dígito verificador usado no resto do site).
 */
import { z } from "zod";
import { isValidCNPJ } from "@/shared/components/contact-form/cnpj";
import { isValidPhoneBR } from "@/shared/lib/phone";

/**
 * CR, LF e NUL — nunca legítimos em texto de formulário; bloqueiam header
 * injection em contextos que interpolam o valor sem escape (ex.: `subject`
 * do e-mail de notificação em `contact-email.ts`, que monta o cabeçalho de
 * assunto com `name` interpolado diretamente).
 */
const CONTROL_CHARS = /[\r\n\0]/;

/**
 * Campo de texto opcional: string vazia (ou só espaços) vira `undefined`
 * antes da validação — mesmo padrão `draftField` do onboarding de
 * representantes (`src/server/trpc/routers/representatives.ts`), para que o
 * client possa mandar `""` em vez de omitir a chave sem virar erro 400.
 */
function optionalTrimmedField(max: number) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z
      .string()
      .trim()
      .max(max)
      .refine((value) => !CONTROL_CHARS.test(value), { message: "invalid_characters" })
      .optional()
  );
}

export const CONTACT_SUBJECTS = ["call_back", "quote", "general"] as const;

export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2)
    .max(200)
    .refine((value) => !CONTROL_CHARS.test(value), { message: "invalid_characters" }),
  email: z.string().trim().toLowerCase().email().max(320),
  phone: z
    .string()
    .trim()
    .min(1)
    .max(30)
    .refine(isValidPhoneBR, { message: "invalid_phone" }),
  companyName: optionalTrimmedField(200),
  // Opcional: string vazia vira `undefined` (bypassa o refine); quando
  // preenchido, precisa ser um CNPJ estruturalmente válido.
  cnpj: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z
      .string()
      .trim()
      .max(18)
      .refine(isValidCNPJ, { message: "invalid_cnpj" })
      .optional()
  ),
  subject: z.enum(CONTACT_SUBJECTS),
  message: optionalTrimmedField(2000),
  productSlug: optionalTrimmedField(200),
  locale: z.enum(["pt", "en"]),
  consent: z.literal(true),
});

/**
 * Honeypot anti-bot: nome do campo invisível no form público. A rota checa
 * ANTES do parse — preenchido = bot, e a resposta é um sucesso silencioso
 * (nada é gravado, e o bot não recebe dica de que foi detectado). Mesmo
 * padrão de `src/server/lib/representative-register.ts`.
 */
export const HONEYPOT_FIELD = "website";

export type ContactInput = z.infer<typeof contactSchema>;
