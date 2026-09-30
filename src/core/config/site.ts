/**
 * External destinations and asset paths used across the site.
 *
 * Controlled via environment variables (NEXT_PUBLIC_* are inlined at build
 * time, so they must be present when `next build` runs). Fallbacks keep the
 * buttons working even when a var is not set in a given environment.
 */
import { locales } from "@/i18n/config";
import { withLeadOrigin, type LeadOrigin } from "@/shared/lib/lead-origin";

/**
 * Catálogo online da ROCO (página de download do catálogo, fora deste site).
 * Pedido do stakeholder em 2026-09-30: o botão "Baixar Catálogo" leva SEMPRE
 * para lá — da home, do slide de reserva do hero e do rodapé.
 */
export const ONLINE_CATALOG_URL = "https://catalogo.roco.com.br/catalogo-roco";

export const siteLinks = {
  /** "Conheça nossos Produtos" — empty until the products URL is defined. */
  products: process.env.NEXT_PUBLIC_PRODUCTS_URL || "",
  /**
   * "Baixar Catálogo": o catálogo online da ROCO (`ONLINE_CATALOG_URL`);
   * `NEXT_PUBLIC_CATALOG_URL` só troca esse endereço. A página própria
   * `/{locale}/catalogo` (formulário + PDF) continua no ar, mas nenhum botão
   * aponta mais para ela — e, sendo endereço externo, o link não leva
   * `?origem=` e abre em nova aba (`externalProps`).
   */
  catalog: process.env.NEXT_PUBLIC_CATALOG_URL || ONLINE_CATALOG_URL,
  /** The catalog PDF itself, served from /public (must stay same-origin so the
   *  browser honours the `download` attribute on the catalog page). */
  catalogPdf:
    process.env.NEXT_PUBLIC_CATALOG_PDF_URL ||
    "/downloads/catalogo-roco-2026.pdf",
  /** Privacy policy — shown next to the LGPD notice when defined. */
  privacy: process.env.NEXT_PUBLIC_PRIVACY_URL || "",
  /**
   * WhatsApp de contato (somente dígitos, com DDI). Usado pelo botão flutuante.
   * Padrão: (47) 3335-2012 → 55 (Brasil) + 47 (DDD) + número.
   */
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "554733352012",
} as const;

/** Route segment of the catalog page, appended after the locale prefix. */
export const CATALOG_SEGMENT = "catalogo";

/** Route segment of the representative pre-registration page. */
export const REPRESENTATIVES_SEGMENT = "representantes";

/** Route segment of the product catalog listing/detail pages. */
export const PRODUCTS_SEGMENT = "produtos";

/** Route segment of the public contact page. */
export const CONTACT_SEGMENT = "contato";

/**
 * Route segment of the quote-list page ("Meu orçamento").
 *
 * Era `carrinho` até a spec 001 (2026-09-29): o stakeholder pediu que toda
 * referência visível a "carrinho" virasse "orçamento" — a URL inclusa. O
 * caminho antigo segue funcionando via redirect permanente em
 * `next.config.ts` (`LEGACY_QUOTE_SEGMENT`). Identificadores técnicos internos
 * (`subject: "cart"`, `cart-store`, `roco_cart_v1`) ficaram como estão: não
 * aparecem para ninguém e renomeá-los só traria risco (ver decisionLog).
 */
export const QUOTE_SEGMENT = "orcamento";

/** Segmento antigo da lista de orçamento — só existe para o redirect 308. */
export const LEGACY_QUOTE_SEGMENT = "carrinho";

/**
 * Segmentos do login do portal interno. Não são traduzidos (o route group
 * `(internal)` é o mesmo nos dois locales) e espelham `PROTECTED_SECTIONS` /
 * `PORTAL_LOGIN_SEGMENT` do `src/proxy.ts` — se algum dia a rota mudar lá,
 * muda aqui junto, senão o botão de login da barra passa a cair no gate de
 * sessão e a pessoa é redirecionada para… o login.
 */
export const PORTAL_SEGMENT = "portal";
export const PORTAL_LOGIN_SEGMENT = "login";

/** Locale-prefixed path of the portal login page (`/pt/portal/login`). */
export function portalLoginPath(locale: string): string {
  return `/${locale}/${PORTAL_SEGMENT}/${PORTAL_LOGIN_SEGMENT}`;
}

/** Locale-prefixed path of the representative pre-registration page. */
export function representativesPath(locale: string): string {
  return `/${locale}/${REPRESENTATIVES_SEGMENT}`;
}

/** Locale-prefixed path of the product catalog listing page. */
export function productsPath(locale: string): string {
  return `/${locale}/${PRODUCTS_SEGMENT}`;
}

/** Locale-prefixed path of the public contact page. */
export function contactPath(locale: string): string {
  return `/${locale}/${CONTACT_SEGMENT}`;
}

/** Locale-prefixed path of the quote-list page (`/pt/orcamento`). */
export function quotePath(locale: string): string {
  return `/${locale}/${QUOTE_SEGMENT}`;
}

/** Filename suggested to the browser when the catalog PDF is downloaded. */
export const CATALOG_PDF_FILENAME = "catalogo-roco-2026.pdf";

/** Locale-prefixed path of the catalog page (`/pt/catalogo`). */
export function catalogPath(locale: string): string {
  return `/${locale}/${CATALOG_SEGMENT}`;
}

/**
 * Resolve a dictionary href to its real destination. Copy in the dictionaries
 * uses stable placeholder anchors (`#produtos`, `#catalogo`, `#representantes`,
 * `#contato`) — here we swap them for the configured URLs, falling back to the
 * internal page while a destination is still undefined. Some dictionary
 * entries (home CTAs, footer columns) already write the literal locale-less
 * path (`/produtos`, `/representantes`) instead of the anchor placeholder;
 * both spellings are treated as aliases of the same destination so copy can
 * use either without producing a broken (non locale-prefixed) link. Bare
 * routes (`/`) pass through untouched.
 *
 * `origin` (optional) tags the destination with the site section the click
 * came from (`?origem=`) — see `@/shared/lib/lead-origin`. It is appended
 * ONLY when the resolved destination is one of this site's own lead-capture
 * pages; every other destination (external URL from env, home, product
 * listing) comes back untouched.
 */
export function resolveDestination(
  href: string,
  locale: string,
  origin?: LeadOrigin
): string {
  const destination = resolveHref(href, locale);

  if (!origin) return destination;

  // A origem só acompanha os destinos que SABEM lê-la: as duas páginas
  // internas de captura de lead. Nunca vai para a home, para a listagem de
  // produtos, nem — principalmente — para uma URL de terceiro configurada
  // via `NEXT_PUBLIC_PRODUCTS_URL`/`NEXT_PUBLIC_CATALOG_URL`, onde vazaria
  // taxonomia interna e poderia colidir com um parâmetro do destino.
  //
  // Compara só o CAMINHO: desde `#ligamos` um destino interno pode chegar
  // aqui já com querystring (`/pt/contato?assunto=call_back`), e comparar a
  // string inteira faria esse caso cair fora — o item perderia a origem sem
  // erro nenhum.
  const destinationPath = destination.split("#")[0].split("?")[0];
  const capturesLeads =
    destinationPath === contactPath(locale) ||
    destinationPath === catalogPath(locale) ||
    destinationPath === quotePath(locale);

  return capturesLeads ? withLeadOrigin(destination, origin) : destination;
}

/** Prefixo de locale já presente num caminho interno (`/pt`, `/en/…`, `/pt?x`). */
const LOCALE_PREFIX = new RegExp(`^/(${locales.join("|")})(?=/|$|\\?|#)`);

/**
 * Garante o prefixo de locale num caminho INTERNO — para links digitados no
 * painel (CTAs da home e do hero), que o operador escreve como
 * `/produtos?category=gas` sem saber de locale. Sem isto o link dependeria do
 * redirect 307 do middleware (um round-trip a mais) e, pior, `/pt/…` digitado
 * à mão levaria o visitante da versão em inglês para a portuguesa.
 *
 * - `/produtos?x#y` → `/{locale}/produtos?x#y`
 * - `/pt/contato` numa página `en` → `/en/contato` (troca, não empilha)
 * - `/` → `/{locale}`
 * - externo (`https:`), `mailto:`, `tel:`, âncora (`#…`) e protocol-relative
 *   (`//…`) → intocados.
 */
export function localizeInternalHref(href: string, locale: string): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const match = LOCALE_PREFIX.exec(href);
  if (match) {
    return match[1] === locale ? href : `/${locale}${href.slice(match[0].length)}`;
  }
  if (href === "/") return `/${locale}`;
  if (href.startsWith("/?") || href.startsWith("/#")) return `/${locale}${href.slice(1)}`;
  return `/${locale}${href}`;
}

/**
 * Destino final de um CTA EDITÁVEL: placeholders/aliases resolvidos
 * (`resolveDestination`, com a origem do lead) e caminho interno sempre com
 * locale (`localizeInternalHref`). Usado pelas seções da home e pelos slides
 * do hero — todo href que veio do banco passa por aqui antes do `<Link>`.
 */
export function resolveCtaHref(href: string, locale: string, origin?: LeadOrigin): string {
  const localized = localizeInternalHref(resolveDestination(href, locale), locale);
  // A origem só é anexada DEPOIS de localizar: um CTA digitado como
  // `/contato?assunto=quote` (não é alias exato) só vira página de captura
  // reconhecível — e ganha `?origem=` — quando já carrega o locale.
  return origin ? resolveDestination(localized, locale, origin) : localized;
}

function resolveHref(href: string, locale: string): string {
  switch (href) {
    case "#produtos":
    case "/produtos":
      return siteLinks.products || productsPath(locale);
    case "#catalogo":
    case "/catalogo":
      return siteLinks.catalog || catalogPath(locale);
    case "#representantes":
    case "/representantes":
      return representativesPath(locale);
    case "#contato":
    case "/contato":
      return contactPath(locale);
    // "Ligamos pra você": a MESMA página de contato, com o assunto
    // pré-selecionado no dropdown (`resolveDefaultSubject` em
    // `app/[locale]/(site)/contato/page.tsx`).
    //
    // Existe como placeholder porque o dicionário trazia o caminho literal
    // `/contato?assunto=call_back&origem=menu` — que `resolveDestination` não
    // reescreve. Consequências reais, medidas no container em 2026-08-30:
    // em EN o dicionário escrevia `/contact?...` e a rota NÃO existe
    // (`CONTACT_SEGMENT` é "contato" nos dois locales), então o 5º item do
    // menu levava a 404; em PT o link saía sem prefixo de locale, dependendo
    // do redirect 307 do middleware e nunca casando com o `pathname` em
    // `isNavLinkActive` — o item jamais ficava ativo nem recebia
    // `aria-current="page"`.
    case "#ligamos":
      return `${contactPath(locale)}?assunto=call_back`;
    // "Meu orçamento" (lista multi-produto) — placeholder para rodapé/CTAs
    // editáveis; o alias literal cobre CTAs digitados no painel.
    case "#orcamento":
    case "/orcamento":
      return quotePath(locale);
    default:
      return href;
  }
}
