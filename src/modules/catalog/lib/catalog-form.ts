/**
 * Lógica pura do formulário de captura do catálogo (`/{locale}/catalogo`).
 *
 * Vive fora do componente por dois motivos: (1) o ambiente de teste do
 * projeto é `node`, sem DOM — só o que é puro dá para cobrir de verdade; e
 * (2) a validação client-side precisa espelhar `contactSchema`
 * (`@/server/lib/contact-submit`), e um espelho que ninguém testa desalinha
 * em silêncio — o visitante vê "enviando" e recebe 400.
 *
 * Sem `server-only` e sem I/O: é importado por um Client Component.
 */
import { CATALOG_PDF_FILENAME } from "@/core/config/site";
import { contactSchema } from "@/server/lib/contact-submit";
import { normalizeLeadOrigin, type LeadOrigin } from "@/shared/lib/lead-origin";
import { isValidPhoneBR } from "@/shared/lib/phone";

/**
 * Assunto com que este formulário grava o lead. Não aparece no dropdown de
 * `/contato` (`SELECTABLE_CONTACT_SUBJECTS`) porque quem o define é esta
 * página, não o visitante — ver `CONTACT_SUBJECTS` em
 * `@/server/lib/contact-submit`, que o aceita e o mapeia para o
 * `conversion_identifier` `download_catalogo` no RD Station.
 */
export const CATALOG_SUBJECT = "catalog" as const;

/**
 * Origem gravada quando a URL não traz `?origem=` — quem chegou direto na
 * página (busca orgânica, link colado, favorito) tem como origem a própria
 * página de catálogo. Quando a URL TRAZ uma origem válida (o rodapé e o CTA
 * do hero já anexam `?origem=rodape` / `?origem=home-hero` via
 * `resolveDestination`), ela vence: saber qual CTA trouxe a pessoa vale mais
 * do que registrar de novo a página onde ela já está.
 */
export const CATALOG_FALLBACK_ORIGIN: LeadOrigin = "catalogo";

/** Tetos espelhados de `contactSchema` — também aplicados como `maxLength`. */
export const CATALOG_NAME_MIN = 2;
export const CATALOG_NAME_MAX = 200;
export const CATALOG_EMAIL_MAX = 320;
export const CATALOG_PHONE_MAX = 30;
export const CATALOG_COMPANY_MAX = 200;

/**
 * O PRÓPRIO campo do schema do servidor, não um regex paralelo.
 *
 * Um espelho aproximado (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) aceitava
 * `joao@empresa.c` e `user@exa_mple.com`, que o zod reprova: o formulário
 * deixava passar, a rota devolvia 400 e o visitante recebia "tente novamente
 * em instantes" — mensagem de falha transitória para um erro permanente que
 * só ele podia corrigir. Reusar o campo elimina a classe inteira do
 * desalinhamento, e não custa bundle: `contact-submit` (com zod) já é
 * importado por este mesmo formulário para o nome do honeypot.
 */
const emailField = contactSchema.shape.email;

export type CatalogFormValues = {
  name: string;
  email: string;
  phone: string;
  companyName: string;
};

export type CatalogFieldName = keyof CatalogFormValues;

/**
 * Código do erro, não a mensagem: a copy vem do dicionário
 * (`catalog.validation.*`), então esta camada continua pura e testável e a
 * tradução segue sendo responsabilidade do i18n.
 */
export type CatalogErrorCode =
  | "required"
  | "nameTooShort"
  | "invalidEmail"
  | "invalidPhone"
  | "consentRequired"
  | "invalid";

export type CatalogFormErrors = Partial<
  Record<CatalogFieldName | "consent", CatalogErrorCode>
>;

/**
 * Espelha `contactSchema` para os campos que este formulário envia. Bloqueia
 * o submit ANTES de qualquer fetch — o servidor revalida tudo de novo, aqui é
 * só para a pessoa receber o erro no campo em vez de um 400 genérico.
 *
 * `companyName` é opcional (só o teto de tamanho vale); `cnpj`, `message` e
 * `productSlug` não existem neste formulário — quem quer falar de um produto
 * específico vai para `/contato`.
 */
export function validateCatalogForm(
  values: CatalogFormValues,
  consent: boolean
): CatalogFormErrors {
  const errors: CatalogFormErrors = {};

  const name = values.name.trim();
  if (!name) errors.name = "required";
  else if (name.length < CATALOG_NAME_MIN) errors.name = "nameTooShort";

  const email = values.email.trim();
  if (!email) errors.email = "required";
  else if (!emailField.safeParse(email).success) errors.email = "invalidEmail";

  const phone = values.phone.trim();
  if (!phone) errors.phone = "required";
  else if (!isValidPhoneBR(phone)) errors.phone = "invalidPhone";

  if (!consent) errors.consent = "consentRequired";

  return errors;
}

/** Se `validateCatalogForm` encontrou algo que impeça o envio. */
export function hasCatalogFormErrors(errors: CatalogFormErrors): boolean {
  return Object.values(errors).some(Boolean);
}

/**
 * Traduz o array `fields` de um 400 (`{ error: "validation", fields: [...] }`)
 * em erros POR CAMPO.
 *
 * Sem isto o `fields` era descartado e qualquer reprovação do servidor virava
 * "Tente novamente em instantes" — mensagem de falha transitória, sem marcar
 * campo nenhum, para um erro permanente que só o visitante podia corrigir.
 * Ele reenviava o mesmo valor e lia a mesma frase.
 *
 * Nome desconhecido (campo que este formulário nem renderiza) é IGNORADO: o
 * caller usa o resultado vazio para decidir entre destacar campos e mostrar o
 * banner genérico.
 */
export function catalogServerFieldErrors(fields: unknown): CatalogFormErrors {
  if (!Array.isArray(fields)) return {};

  const errors: CatalogFormErrors = {};
  for (const raw of fields) {
    if (typeof raw !== "string") continue;
    const mapped = SERVER_FIELD_ERRORS[raw];
    if (mapped) errors[mapped[0]] = mapped[1];
  }
  return errors;
}

/**
 * Campo do servidor → (campo do formulário, código de erro). `email`/`phone`/
 * `consent` têm mensagem específica; os demais caem em `invalid`, porque a
 * reprovação nesses casos é de FORMATO (caractere de controle, tamanho) e
 * "campo obrigatório" seria uma explicação errada.
 */
const SERVER_FIELD_ERRORS: Record<
  string,
  [CatalogFieldName | "consent", CatalogErrorCode]
> = {
  name: ["name", "invalid"],
  email: ["email", "invalidEmail"],
  phone: ["phone", "invalidPhone"],
  companyName: ["companyName", "invalid"],
  consent: ["consent", "consentRequired"],
};

/**
 * Origem efetiva do lead: a da URL quando válida, senão `"catalogo"`. Valor
 * forjado no `?origem=` cai no fallback em vez de virar `undefined` — esta
 * página SEMPRE sabe dizer de onde o lead veio, nem que seja dela mesma.
 */
export function resolveCatalogOrigin(value: unknown): LeadOrigin {
  return normalizeLeadOrigin(value) ?? CATALOG_FALLBACK_ORIGIN;
}

export type CatalogDownloadLink = {
  href: string;
  download?: string;
  target?: string;
  rel?: string;
};

/**
 * Atributos do link do PDF — usados tanto pelo link visível de fallback
 * quanto pelo disparo programático do download.
 *
 * A URL do PDF é configurável pelo admin (`site_settings` → env → constante,
 * ver `getCatalogPdfUrl`), então pode ser same-origin (`/downloads/…`) OU um
 * objeto no R2 (`https://pub-….r2.dev/…`). Os dois casos exigem tratamento
 * diferente:
 *
 *  - **same-origin**: `download` é honrado, o arquivo baixa e a pessoa
 *    permanece no painel de sucesso.
 *  - **cross-origin**: o navegador IGNORA `download` (é uma restrição de
 *    segurança, não um detalhe de implementação) e NAVEGA para o PDF —
 *    destruindo o estado de sucesso recém-conquistado. Por isso o alvo vira
 *    uma aba nova, com `rel` fechando o acesso a `window.opener`.
 */
export function catalogDownloadLink(pdfUrl: string): CatalogDownloadLink {
  if (typeof pdfUrl !== "string" || pdfUrl === "") return { href: pdfUrl };

  return isSameOriginUrl(pdfUrl)
    ? { href: pdfUrl, download: CATALOG_PDF_FILENAME }
    : { href: pdfUrl, target: "_blank", rel: "noopener noreferrer" };
}

/**
 * Same-origin = caminho relativo à raiz (`/downloads/…`). `//host/x` é
 * protocol-relative (outro host) e `https://…` é absoluto — ambos externos.
 * Comparação por prefixo, sem `new URL()`: href vindo de banco/env é entrada
 * não confiável e `new URL` lança em string malformada (a mesma classe de
 * defeito que já derrubou uma página desta base — ver o guard de `URIError`
 * em `resolveCategoryCardHref`).
 */
function isSameOriginUrl(url: string): boolean {
  return url.startsWith("/") && !url.startsWith("//");
}
