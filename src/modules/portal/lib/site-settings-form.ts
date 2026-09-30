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

// ---------------------------------------------------------------------------
// Redes sociais: aceitar o que o operador souber digitar
// ---------------------------------------------------------------------------

/**
 * Resultado da leitura de UM campo de rede social. O operador pode colar o
 * link completo, digitar só o `@perfil` / nome da página ou — no WhatsApp — o
 * número com DDD; o sistema monta o link canônico que vai para o rodapé.
 */
export type SocialLinkResult =
  | { kind: "empty" }
  | { kind: "ok"; url: string }
  | { kind: "error"; reason: "invalid" | "wrongNetwork" | "invalidPhone" | "tooLong" };

/** Domínios aceitos por rede (subdomínios inclusos: `br.linkedin.com`, `api.whatsapp.com`…). */
const NETWORK_DOMAINS: Record<SocialNetwork, readonly string[]> = {
  instagram: ["instagram.com", "instagr.am"],
  linkedin: ["linkedin.com", "lnkd.in"],
  youtube: ["youtube.com", "youtu.be"],
  whatsapp: ["wa.me", "whatsapp.com"],
};

/** Terminações que fazem um texto sem barra ser lido como domínio ("instagram.com") e não como perfil. */
const DOMAIN_SUFFIX = /\.(com|com\.br|br|net|org|me|am|in|be|app)$/i;

const INSTAGRAM_HANDLE = /^[A-Za-z0-9._]{1,30}$/;
const YOUTUBE_HANDLE = /^[A-Za-z0-9._-]{3,30}$/;
const LINKEDIN_SLUG = /^[A-Za-z0-9._%-]{2,100}$/;
const LINKEDIN_SECTION = /^(company|in|showcase|school)\/[^/\s]+/i;

function matchesNetwork(host: string, network: SocialNetwork): boolean {
  const normalized = host.toLowerCase();
  return NETWORK_DOMAINS[network].some((domain) => normalized === domain || normalized.endsWith(`.${domain}`));
}

/** Caminho sem barra final, sem query e sem fragmento ("" se vazio). */
function cleanPath(url: URL): string {
  return url.pathname.replace(/\/+$/, "");
}

/** Número de WhatsApp: tira máscara e zeros à esquerda; 10–11 dígitos (DDD + número) ganham o DDI 55. */
export function normalizeWhatsappNumber(value: string): string | null {
  const digits = value.replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits.length >= 12 && digits.length <= 15 ? digits : null;
}

function canonicalFromUrl(network: SocialNetwork, url: URL): SocialLinkResult {
  if (url.protocol !== "http:" && url.protocol !== "https:") return { kind: "error", reason: "invalid" };
  if (!matchesNetwork(url.hostname, network)) return { kind: "error", reason: "wrongNetwork" };
  const path = cleanPath(url);
  const host = url.hostname.toLowerCase();

  switch (network) {
    case "instagram":
      return path ? { kind: "ok", url: `https://www.instagram.com${path}` } : { kind: "error", reason: "invalid" };
    case "linkedin":
      if (!path) return { kind: "error", reason: "invalid" };
      return { kind: "ok", url: host.endsWith("lnkd.in") ? `https://lnkd.in${path}` : `https://www.linkedin.com${path}` };
    case "youtube":
      if (!path) return { kind: "error", reason: "invalid" };
      return { kind: "ok", url: host.endsWith("youtu.be") ? `https://youtu.be${path}` : `https://www.youtube.com${path}` };
    case "whatsapp": {
      // wa.me/<número> · api.whatsapp.com/send?phone=<número> → wa.me/<número>;
      // wa.me/message/<código> (link curto do WhatsApp Business) e canais ficam como estão.
      const phone = host.endsWith("wa.me") ? path.slice(1) : (url.searchParams.get("phone") ?? "");
      if (/^\d+$/.test(phone)) {
        const number = normalizeWhatsappNumber(phone);
        return number ? { kind: "ok", url: `https://wa.me/${number}` } : { kind: "error", reason: "invalidPhone" };
      }
      if (!path) return { kind: "error", reason: "invalidPhone" };
      return { kind: "ok", url: host.endsWith("wa.me") ? `https://wa.me${path}` : `https://${host}${path}` };
    }
  }
}

/**
 * Converte o que o operador digitou no link canônico da rede — ou diz o que
 * está errado. Aceita:
 * - link completo (com ou sem `https://`, com `www.` ou não);
 * - Instagram/YouTube: `@perfil` ou só o nome do perfil;
 * - LinkedIn: nome da página como aparece no link (`roco-industria`) ou
 *   `company/roco-industria`;
 * - WhatsApp: número com DDD, com ou sem máscara/DDI.
 * Link de OUTRA rede no campo errado é recusado (o ícone do rodapé ficaria errado).
 */
export function normalizeSocialLink(network: SocialNetwork, raw: string): SocialLinkResult {
  const text = raw.trim();
  if (text === "") return { kind: "empty" };
  if (text.length > SOCIAL_URL_MAX_LENGTH) return { kind: "error", reason: "tooLong" };
  if (/\s/.test(text) && network !== "whatsapp") return { kind: "error", reason: "invalid" };

  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text);
  const looksLikeDomain = text.includes("/") || DOMAIN_SUFFIX.test(text);

  if (network === "whatsapp" && !hasScheme && !/[a-z]/i.test(text)) {
    const number = normalizeWhatsappNumber(text);
    return number ? { kind: "ok", url: `https://wa.me/${number}` } : { kind: "error", reason: "invalidPhone" };
  }

  if (network === "linkedin" && !hasScheme && LINKEDIN_SECTION.test(text)) {
    return { kind: "ok", url: `https://www.linkedin.com/${text.replace(/\/+$/, "")}` };
  }

  if (hasScheme || looksLikeDomain) {
    try {
      return canonicalFromUrl(network, new URL(hasScheme ? text : `https://${text}`));
    } catch {
      return { kind: "error", reason: "invalid" };
    }
  }

  // Só o nome do perfil / página.
  const handle = text.replace(/^@/, "");
  switch (network) {
    case "instagram":
      return INSTAGRAM_HANDLE.test(handle)
        ? { kind: "ok", url: `https://www.instagram.com/${handle}` }
        : { kind: "error", reason: "invalid" };
    case "youtube":
      return YOUTUBE_HANDLE.test(handle)
        ? { kind: "ok", url: `https://www.youtube.com/@${handle}` }
        : { kind: "error", reason: "invalid" };
    case "linkedin":
      return LINKEDIN_SLUG.test(handle)
        ? { kind: "ok", url: `https://www.linkedin.com/company/${handle}` }
        : { kind: "error", reason: "invalid" };
    case "whatsapp":
      return { kind: "error", reason: "invalidPhone" };
  }
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
