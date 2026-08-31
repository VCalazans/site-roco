/**
 * Payload da Conversions API do RD Station para os formulários da landing.
 *
 * PURO e sem I/O de propósito (sem `server-only`, sem `fetch`): a montagem e o
 * saneamento do payload ficam isolados do envio, que vive em
 * `rd-station-send.ts`.
 *
 * ⚠️ Este arquivo é uma versão ENXUTA do módulo homônimo da branch do site
 * novo. Lá ele depende de `zod` e do schema de `contact-submit`, que existem
 * porque aquela branch tem backend (Postgres, Drizzle, tRPC). Esta landing não
 * tem NENHUM disso — `package.json` aqui traz só `next`, `react` e o
 * essencial —, então a validação é feita à mão. Ao unificar as duas bases (o
 * merge do site novo), este arquivo deve ser DESCARTADO em favor daquele, não
 * mesclado: são o mesmo conceito em dois contextos distintos.
 */

/** Caracteres de controle que quebram cabeçalho/linha em consumidores a jusante. */
const CONTROL_CHARS = /[\r\n\0]/g;

/** Teto por campo. Nenhum é contrato do RD — ver `MESSAGE_MAX_LENGTH`. */
const FIELD_MAX_LENGTH = 200;

/**
 * Teto da mensagem livre. O RD não documenta limite para o VALOR de um campo
 * personalizado; 1000 é o único número que a documentação publica por perto (o
 * `label` de um campo aceita 1000), usado aqui como âncora de engenharia.
 */
export const MESSAGE_MAX_LENGTH = 1000;
const MESSAGE_TRUNCATION_SUFFIX = "… (mensagem truncada)";

/**
 * Identificadores de conversão — string livre na API (ao contrário dos `cf_*`,
 * não exigem cadastro prévio no painel), então separar por intenção custa zero
 * e o funil do RD distingue as origens.
 *
 * Os mesmos valores usados pelo site novo, para que o histórico do RD não fique
 * partido em dois vocabulários quando aquela versão entrar no ar.
 */
export const CONVERSION_IDENTIFIERS = {
  catalog: "download_catalogo",
  general: "contato_geral",
} as const;

export type RdLeadSubject = keyof typeof CONVERSION_IDENTIFIERS;

/** Origens aceitas — lista FECHADA, pelo mesmo motivo do site novo: `cf_origem` */
/** é taxonomia nossa, não texto livre vindo do navegador. */
export const RD_LEAD_ORIGINS = ["catalogo", "menu", "home"] as const;
export type RdLeadOrigin = (typeof RD_LEAD_ORIGINS)[number];

export type RdLeadInput = {
  name: string;
  email: string;
  phone?: string;
  city?: string;
  state?: string;
  cnpj?: string;
  message?: string;
  subject: RdLeadSubject;
  origin?: RdLeadOrigin;
};

/**
 * Campos do payload. Os `cf_*` são CUSTOMIZADOS e precisam existir na conta do
 * RD antes do envio; `name`/`email`/`personal_phone`/`city`/`state` são PADRÃO
 * e não exigem cadastro nenhum.
 *
 * `city`/`state` são padrão de propósito: a conta tem um `cf_seu_estado`, mas
 * duplicar num campo customizado o que a API já modela nativamente criaria
 * duas fontes de verdade e ficaria de fora dos relatórios nativos do RD.
 */
export type RdConversionPayload = {
  event_type: "CONVERSION";
  event_family: "CDP";
  payload: {
    conversion_identifier: string;
    name: string;
    email: string;
    personal_phone?: string;
    city?: string;
    state?: string;
    cf_cnpj?: string;
    cf_mensagem?: string;
    cf_origem?: string;
  };
};

/** Remove caracteres de controle, colapsa espaços e aplica teto. */
function sanitize(value: string, max: number = FIELD_MAX_LENGTH): string {
  return value.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

/**
 * Prepara a mensagem livre para `cf_mensagem`: achata quebras de linha (o campo
 * é exibido em UMA linha na ficha do contato, e o campo de origem é um
 * `<textarea>`) e trunca no limite de PALAVRA, nunca no meio dela.
 */
export function buildMessageSummary(
  message: string,
  max: number = MESSAGE_MAX_LENGTH
): string {
  const flat = message.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;

  const budget = Math.max(0, max - MESSAGE_TRUNCATION_SUFFIX.length);
  const clipped = flat.slice(0, budget);
  const lastSpace = clipped.lastIndexOf(" ");
  const body = lastSpace > 0 ? clipped.slice(0, lastSpace) : clipped;
  return `${body}${MESSAGE_TRUNCATION_SUFFIX}`;
}

/** E-mail: checagem deliberadamente frouxa — quem valida de verdade é o RD. */
/** O objetivo aqui é só barrar lixo óbvio antes de gastar uma chamada de rede. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Valida e normaliza o corpo recebido pela rota. Devolve `null` quando o
 * mínimo (nome + e-mail plausível) não veio — o resto é opcional por desenho:
 * um lead com nome e e-mail já vale, e recusá-lo por causa de um campo
 * acessório seria perder contato real.
 */
export function parseRdLeadInput(body: unknown): RdLeadInput | null {
  if (typeof body !== "object" || body === null) return null;
  const raw = body as Record<string, unknown>;

  const readString = (key: string): string | undefined => {
    const value = raw[key];
    if (typeof value !== "string") return undefined;
    const clean = sanitize(value);
    return clean.length > 0 ? clean : undefined;
  };

  const name = readString("name");
  const email = readString("email")?.toLowerCase();
  if (!name || !email || !EMAIL_SHAPE.test(email) || email.length > 320) return null;

  const subject: RdLeadSubject = raw.subject === "catalog" ? "catalog" : "general";
  const originRaw = raw.origin;
  const origin =
    typeof originRaw === "string" && (RD_LEAD_ORIGINS as readonly string[]).includes(originRaw)
      ? (originRaw as RdLeadOrigin)
      : undefined;

  const messageRaw = raw.message;
  const message =
    typeof messageRaw === "string" && messageRaw.trim().length > 0
      ? buildMessageSummary(messageRaw)
      : undefined;

  return {
    name,
    email,
    phone: readString("phone"),
    city: readString("city"),
    state: readString("state"),
    cnpj: readString("cnpj"),
    message,
    subject,
    origin,
  };
}

/** Monta o payload final. Campo ausente é OMITIDO, nunca enviado vazio. */
export function buildRdConversionPayload(input: RdLeadInput): RdConversionPayload {
  return {
    event_type: "CONVERSION",
    event_family: "CDP",
    payload: {
      conversion_identifier: CONVERSION_IDENTIFIERS[input.subject],
      name: input.name,
      email: input.email,
      ...(input.phone ? { personal_phone: input.phone } : {}),
      ...(input.city ? { city: input.city } : {}),
      ...(input.state ? { state: input.state } : {}),
      ...(input.cnpj ? { cf_cnpj: input.cnpj } : {}),
      ...(input.message ? { cf_mensagem: input.message } : {}),
      ...(input.origin ? { cf_origem: input.origin } : {}),
    },
  };
}
