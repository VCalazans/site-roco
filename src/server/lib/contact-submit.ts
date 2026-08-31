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
 * funil separe as cinco intenções de negócio.
 *
 * `catalog` e `cart` NÃO aparecem no dropdown de `/contato`: são definidos
 * pelos próprios formulários do catálogo (`/{locale}/catalogo`) e do
 * carrinho de cotação, que reaproveitam esta mesma rota em vez de ter
 * endpoint próprio. Use `SELECTABLE_CONTACT_SUBJECTS` para renderizar opções
 * ao visitante.
 */
export const CONTACT_SUBJECTS = ["call_back", "quote", "general", "catalog", "cart"] as const;

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

/** Teto de itens por carrinho — limita o custo da resolução de slugs no servidor. */
export const MAX_CART_ITEMS = 20;

/** Teto de quantidade por item — bound de sanidade, não uma regra de estoque. */
export const MAX_CART_ITEM_QUANTITY = 9999;

const cartItemSchema = z.object({
  slug: z.string().trim().min(1).max(200),
  quantity: z.number().int().min(1).max(MAX_CART_ITEM_QUANTITY),
});

const contactObjectSchema = z.object({
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
  /**
   * Itens do carrinho de cotação — só populado quando `subject === "cart"`
   * (ver `.superRefine` abaixo). `slug`/`quantity` crus do cliente: o
   * servidor resolve nome/SKU reais no `POST /api/contact` antes de gravar
   * ou enviar a qualquer canal (mesmo critério de `productSlug` acima).
   */
  items: z.array(cartItemSchema).min(1).max(MAX_CART_ITEMS).optional(),
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
 * `items` é OBRIGATÓRIO quando `subject === "cart"` (o carrinho não faz
 * sentido vazio) e deve estar AUSENTE para os outros quatro assuntos — eles
 * continuam usando o par singular `productSlug`/`productName`/`productSku`,
 * cujo contrato fica intocado. `.superRefine` em vez de `z.discriminatedUnion`
 * de propósito: preserva `.shape` no schema resultante (Zod v4 devolve `this`
 * a partir de `.superRefine`, ao contrário do `ZodEffects` do Zod v3) — o
 * espelho client (`contactSchema.shape.email`, ver `modules/contact` e
 * `modules/catalog`) continua funcionando sem mudança.
 */
export const contactSchema = contactObjectSchema.superRefine((data, ctx) => {
  if (data.subject === "cart") {
    if (!data.items || data.items.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "cart_items_required",
        path: ["items"],
      });
    }
    return;
  }

  if (data.items !== undefined) {
    ctx.addIssue({
      code: "custom",
      message: "cart_items_not_allowed",
      path: ["items"],
    });
  }
});

/**
 * Honeypot anti-bot: nome do campo invisível no form público. A rota checa
 * ANTES do parse — preenchido = bot, e a resposta é um sucesso silencioso
 * (nada é gravado, e o bot não recebe dica de que foi detectado). Mesmo
 * padrão de `src/server/lib/representative-register.ts`.
 */
export const HONEYPOT_FIELD = "website";

export type ContactInput = z.infer<typeof contactSchema>;
