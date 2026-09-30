/**
 * Regras puras da tela "Configurações do site" (validação e (de)serialização),
 * separadas do componente para serem testáveis.
 */

/** Redes suportadas — as mesmas quatro que o rodapé renderiza (`SocialLinks`). */
export const SOCIAL_NETWORKS = ["instagram", "linkedin", "youtube", "whatsapp"] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];
export type SocialLinksForm = Record<SocialNetwork, string>;

export const EMPTY_SOCIAL_LINKS: SocialLinksForm = {
  instagram: "",
  linkedin: "",
  youtube: "",
  whatsapp: "",
};

/** Teto por URL: o valor inteiro de `social.links` (JSON) tem no máximo 2000 caracteres. */
export const SOCIAL_URL_MAX_LENGTH = 400;

/**
 * Lê o valor salvo de `social.links`. Tolerante: um valor que não é um objeto
 * JSON (o editor antigo aceitava texto cru) devolve campos vazios e
 * `invalid: true`, para a tela avisar que o próximo salvamento o substitui em
 * vez de quebrar.
 */
export function parseSocialLinks(raw: string | undefined): {
  values: SocialLinksForm;
  invalid: boolean;
} {
  if (raw === undefined || raw.trim() === "") {
    return { values: { ...EMPTY_SOCIAL_LINKS }, invalid: false };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { values: { ...EMPTY_SOCIAL_LINKS }, invalid: true };
    }
    const record = parsed as Record<string, unknown>;
    const values = { ...EMPTY_SOCIAL_LINKS };
    for (const network of SOCIAL_NETWORKS) {
      const value = record[network];
      if (typeof value === "string") values[network] = value.trim();
    }
    return { values, invalid: false };
  } catch {
    return { values: { ...EMPTY_SOCIAL_LINKS }, invalid: true };
  }
}

/**
 * Valor de `social.links` a gravar: JSON só com as redes preenchidas, na ordem
 * fixa. Todas em branco viram `"{}"` (o servidor recusa string vazia). Chaves
 * desconhecidas que estivessem no JSON antigo não são preservadas — o site só
 * lê essas quatro.
 */
export function serializeSocialLinks(values: SocialLinksForm): string {
  const filled: Partial<SocialLinksForm> = {};
  for (const network of SOCIAL_NETWORKS) {
    const value = values[network].trim();
    if (value) filled[network] = value;
  }
  return JSON.stringify(filled);
}

/** `http(s)://host/...` sem espaços. */
export function isHttpUrl(value: string): boolean {
  const text = value.trim();
  if (text === "" || /\s/.test(text)) return false;
  try {
    const url = new URL(text);
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname !== "";
  } catch {
    return false;
  }
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/**
 * Telefone/WhatsApp só com dígitos (com DDI e DDD): aceita máscara, espaços e
 * `+` na digitação e devolve o formato gravado pelo seed (`554733352012`), ou
 * `null` se não tiver entre 10 e 15 dígitos (E.164).
 */
export function normalizePhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

/**
 * Local do PDF do catálogo: URL `http(s)` ou caminho iniciado por uma barra
 * (`/downloads/...`). `//host` é rejeitado — seria uma URL sem esquema que o
 * navegador trataria como outro domínio.
 */
export function isCatalogLocation(value: string): boolean {
  const text = value.trim();
  if (text === "" || /\s/.test(text)) return false;
  if (/^https?:\/\//i.test(text)) return isHttpUrl(text);
  return text.startsWith("/") && !text.startsWith("//");
}
