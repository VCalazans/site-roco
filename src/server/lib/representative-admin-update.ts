/**
 * Contrato da edição COMPLETA de um cadastro de representante pelo admin
 * (`representatives.update`). Puro (sem I/O) para ser testável isoladamente.
 *
 * Semântica de cada campo:
 *   - `undefined` → não mexe;
 *   - `null` ou string vazia → limpa (só nos campos opcionais);
 *   - string → grava, já normalizada (CNPJ e telefone com máscara, e-mail em
 *     minúsculas).
 *
 * `name` e `email` pertencem à tabela `user`; os demais a `representatives`.
 * Obrigatórios que o admin NÃO pode apagar: `name` e `email` (o e-mail é o
 * login do representante).
 */
import { z } from "zod";
import { formatCNPJ, isValidCNPJ } from "@/shared/components/contact-form/cnpj";
import { formatPhoneBR, isValidPhoneBR } from "@/shared/lib/phone";

/** "" / só espaços → `null` (limpar); `undefined` continua "não mexer". */
function clearable(max: number) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().trim().max(max).nullable().optional()
  );
}

export const representativeAdminUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "required").max(200).optional(),
  email: z.string().trim().toLowerCase().email("invalid_email").max(320).optional(),
  companyName: clearable(200),
  cnpj: clearable(18)
    .refine((value) => value == null || isValidCNPJ(value), { message: "invalid_cnpj" })
    .transform((value) => (value == null ? value : formatCNPJ(value))),
  phone: clearable(30)
    .refine((value) => value == null || isValidPhoneBR(value), { message: "invalid_phone" })
    .transform((value) => (value == null ? value : formatPhoneBR(value))),
  region: clearable(120),
  notes: clearable(2000),
});

export type RepresentativeAdminUpdateInput = z.input<typeof representativeAdminUpdateSchema>;
export type RepresentativeAdminUpdate = z.output<typeof representativeAdminUpdateSchema>;

/** Separa o patch parseado entre as duas tabelas, descartando `undefined`. */
export function splitRepresentativeAdminUpdate(input: RepresentativeAdminUpdate) {
  const { id, name, email, ...representativeFields } = input;

  const userPatch: { name?: string; email?: string } = {};
  if (name !== undefined) userPatch.name = name;
  if (email !== undefined) userPatch.email = email;

  const representativePatch = Object.fromEntries(
    Object.entries(representativeFields).filter(([, value]) => value !== undefined)
  ) as Partial<Record<keyof typeof representativeFields, string | null>>;

  return { id, userPatch, representativePatch };
}
