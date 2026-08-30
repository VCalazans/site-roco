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
import {
  LEAD_ORIGINS,
  normalizeLeadOrigin,
  normalizeUtmValue,
  UTM_MAX_LENGTH,
} from "@/shared/lib/lead-origin";
import { isValidPhoneBR } from "@/shared/lib/phone";

/**
 * CR, LF e NUL — nunca legítimos em texto de formulário; bloqueiam header
 * injection em contextos que interpolam o valor sem escape (ex.: `subject`
 * do e-mail de notificação em `contact-email.ts`, que monta o cabeçalho de
 * assunto com `name` interpolado diretamente).
 */
const CONTROL_CHARS = /[\r\n\0]/;

/**
 * Só NUL — para campos que NUNCA entram num cabeçalho, apenas no CORPO do
 * e-mail (hoje: `message`). Bloquear `\r\n` neles seria over-block com custo
 * real: o campo de mensagem é um `<textarea>`, então apertar Enter — o
 * comportamento mais natural do mundo ao escrever um pedido de orçamento —
 * reprovava a submissão inteira com 400 e o visitante lia "tente novamente em
 * instantes" sem ter o que corrigir.
 */
const BODY_CONTROL_CHARS = /\0/;

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

/**
 * Igual a `optionalTrimmedField`, mas aceita quebras de linha — para o texto
 * livre que só é interpolado no CORPO da notificação (`contact-email.ts`
 * escapa o HTML e o renderiza dentro de um `<pre>`), nunca num cabeçalho.
 */
function optionalMultilineField(max: number) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z
      .string()
      .trim()
      .max(max)
      .refine((value) => !BODY_CONTROL_CHARS.test(value), { message: "invalid_characters" })
      .optional()
  );
}

/**
 * Assuntos aceitos pela rota — espelham o enum `contact_subject` do banco
 * (`src/db/schema/contact.ts`), e cada um vira um `conversion_identifier`
 * distinto no RD Station (`buildRdStationConversionPayload`), para que o
 * funil separe as quatro intenções de negócio.
 *
 * `catalog` NÃO aparece no dropdown de `/contato`: é definido pelo próprio
 * formulário do catálogo (`/{locale}/catalogo`), que reaproveita esta mesma
 * rota em vez de ter endpoint próprio. Use `SELECTABLE_CONTACT_SUBJECTS`
 * para renderizar opções ao visitante.
 */
export const CONTACT_SUBJECTS = ["call_back", "quote", "general", "catalog"] as const;

/** Assuntos que o visitante escolhe à mão no dropdown de `/contato`. */
export const SELECTABLE_CONTACT_SUBJECTS = ["call_back", "quote", "general"] as const;

export type ContactSubject = (typeof CONTACT_SUBJECTS)[number];
export type SelectableContactSubject = (typeof SELECTABLE_CONTACT_SUBJECTS)[number];

/**
 * Origem (seção do site) e campanha (UTM) chegam da URL — entrada NÃO
 * confiável. Ambas são DESCARTADAS em silêncio quando inválidas (viram
 * `undefined` → `null` no banco) em vez de reprovarem o parse: um parâmetro
 * de rastreio malformado jamais pode impedir a captura de um lead real.
 */
const leadOriginField = z.preprocess(
  (value) => normalizeLeadOrigin(value),
  z.enum(LEAD_ORIGINS).optional()
);

function utmField() {
  return z.preprocess(
    (value) => normalizeUtmValue(value),
    z.string().max(UTM_MAX_LENGTH).optional()
  );
}

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
  // Multilinha: `<textarea>` no formulário, e o valor só aparece no corpo do
  // e-mail (escapado, dentro de `<pre>`) — nunca num cabeçalho.
  message: optionalMultilineField(2000),
  productSlug: optionalTrimmedField(200),
  /** Seção do site que originou o clique (`?origem=`) — ver `lead-origin`. */
  origin: leadOriginField,
  /** Campanha externa (`?utm_*=`) — vai aos campos padrão `traffic_*` do RD. */
  utmSource: utmField(),
  utmMedium: utmField(),
  utmCampaign: utmField(),
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
