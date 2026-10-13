/**
 * Peças do Cloudflare Turnstile (verificação anti-robô) comuns ao NAVEGADOR e
 * ao SERVIDOR: nomes das ações, campo do token, códigos de erro das rotas e a
 * site key. Sem `server-only` e sem I/O — é importado pelos formulários
 * (client components), pelas rotas e pelo login (`@/core/auth`).
 *
 * A verificação de verdade mora em `@/server/lib/turnstile` (server-only, com
 * o segredo); o widget, em `@/shared/components/turnstile`.
 */

/**
 * Ação de cada formulário — vai no `render` do widget e volta na resposta do
 * siteverify, que o servidor compara com a esperada: um token gerado no
 * formulário de catálogo não serve para o login. Limite da Cloudflare: até 32
 * caracteres, só letras, dígitos, `_` e `-` (por isso sem acento).
 */
export const TURNSTILE_ACTIONS = {
  contact: "contato",
  catalog: "catalogo",
  quote: "orcamento",
  register: "cadastro",
  login: "login",
  passwordReset: "senha",
  emailConfirmation: "confirmacao",
} as const;

export type TurnstileAction = (typeof TURNSTILE_ACTIONS)[keyof typeof TURNSTILE_ACTIONS];

/** Nome do token no corpo JSON das rotas e no `FormData` do login. */
export const TURNSTILE_TOKEN_FIELD = "turnstileToken";

/**
 * Teto do token (documentado pela Cloudflare: até 2048 caracteres). Maior que
 * isso não é token — o servidor recusa sem gastar uma chamada ao siteverify.
 */
export const TURNSTILE_TOKEN_MAX_LENGTH = 2048;

/** `{ error }` das rotas quando o Turnstile recusou o envio (HTTP 400). */
export const CAPTCHA_ERROR = "captcha";
/** `{ error }` das rotas quando não deu para validar o token (Cloudflare fora do ar, HTTP 503). */
export const CAPTCHA_UNAVAILABLE_ERROR = "captcha_unavailable";

/**
 * Ação esperada em `POST /api/contact`, que atende três formulários: o
 * assunto define quem enviou. Recebe o valor CRU do corpo (a rota valida o
 * Turnstile antes do schema): assunto desconhecido cai em `contato`, e o
 * schema o reprova logo depois. Os formulários usam a MESMA função para
 * escolher a ação do widget — cliente e servidor nunca divergem.
 */
export function contactTurnstileAction(subject: unknown): TurnstileAction {
  if (subject === "catalog") return TURNSTILE_ACTIONS.catalog;
  if (subject === "cart") return TURNSTILE_ACTIONS.quote;
  return TURNSTILE_ACTIONS.contact;
}

/**
 * Site key pública do widget. É `NEXT_PUBLIC_*`, então o `next build` a
 * EMBUTE no bundle (navegador e servidor): mudar exige rebuild da imagem.
 * Vazia = Turnstile desligado no navegador (o widget não aparece).
 */
export function getTurnstileSiteKey(): string {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
}
