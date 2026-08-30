/**
 * Rastreio de ORIGEM de lead — de qual seção do site partiu o clique que
 * levou a pessoa ao formulário (`/{locale}/contato`, `/{locale}/catalogo`).
 *
 * Duas dimensões COMPLEMENTARES, que nunca se sobrescrevem:
 *  - ORIGEM (`?origem=`): seção INTERNA do site (hero, rodapé, detalhe de
 *    produto…). Lista FECHADA — o valor é taxonomia nossa, não texto livre
 *    do visitante. Vai ao RD Station no campo customizado `cf_origem`.
 *  - UTM (`utm_source`/`utm_medium`/`utm_campaign`): campanha EXTERNA que
 *    trouxe a pessoa ao site. Texto livre de terceiro (Google Ads, e-mail,
 *    rede social) — só sanitizado, nunca restrito a uma lista. Vai ao RD
 *    Station nos campos PADRÃO `traffic_source`/`traffic_medium`/
 *    `traffic_campaign` (nativos da Conversions API, sem configuração no
 *    painel).
 *
 * Módulo PURO de propósito (sem `server-only`, sem I/O): é consumido pelo
 * schema do servidor (`@/server/lib/contact-submit`), pela resolução de
 * destino (`@/core/config/site`) e por componentes client — e precisa ser
 * testável no Vitest sem mocks.
 */

/**
 * Seções do site que podem originar um lead. Lista FECHADA: valor fora dela
 * (visitante editou a URL, link antigo, bot) é descartado em vez de gravado
 * — o campo é taxonomia interna, então aceitar texto livre poluiria o CRM e
 * abriria injeção de conteúdo arbitrário no `cf_origem` do RD Station.
 *
 * Ao acrescentar um valor aqui, lembre de dar a ele um rótulo em
 * `LEAD_ORIGIN_LABELS` (`@/server/lib/contact-email`) — o `Record` tipado
 * quebra o build se faltar.
 */
export const LEAD_ORIGINS = [
  "home-hero",
  "home-sobre",
  "home-categorias",
  "home-destaques",
  "home-portal",
  "produtos-listagem",
  "produto-detalhe",
  "catalogo",
  "menu",
  "rodape",
] as const;

export type LeadOrigin = (typeof LEAD_ORIGINS)[number];

/** Nome do parâmetro de querystring que carrega a origem. */
export const LEAD_ORIGIN_PARAM = "origem";

/** Parâmetros de campanha externa lidos da URL e repassados ao RD Station. */
export const UTM_PARAMS = ["utm_source", "utm_medium", "utm_campaign"] as const;

/** Teto de tamanho de cada valor de UTM (texto livre de terceiro). */
export const UTM_MAX_LENGTH = 120;

/**
 * CR, LF e NUL — mesma regra de `CONTROL_CHARS` em
 * `@/server/lib/contact-submit` (duplicada aqui de propósito: este módulo é
 * `shared/` e não deve depender de `server/`). Valores de UTM acabam
 * interpolados no corpo do e-mail de notificação, então caractere de
 * controle vindo da URL nunca pode passar.
 */
const CONTROL_CHARS = /[\r\n\0]/;

/**
 * Valida um valor cru (querystring, corpo de request) contra a lista
 * fechada. Retorna `undefined` — nunca lança e nunca devolve o valor cru —
 * para que a origem inválida simplesmente não seja gravada, em vez de
 * derrubar a submissão do lead.
 */
export function normalizeLeadOrigin(value: unknown): LeadOrigin | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return (LEAD_ORIGINS as readonly string[]).includes(trimmed)
    ? (trimmed as LeadOrigin)
    : undefined;
}

/**
 * Sanitiza um valor de UTM: apara espaços, descarta vazio, descarta
 * caractere de controle e trunca em `UTM_MAX_LENGTH`. Descartar (virar
 * `undefined`) em vez de rejeitar é deliberado: uma campanha mal formada na
 * URL não pode impedir a captura do lead.
 */
export function normalizeUtmValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (CONTROL_CHARS.test(trimmed)) return undefined;
  return trimmed.slice(0, UTM_MAX_LENGTH);
}

/**
 * Anexa `?origem=…` (ou `&origem=…`) a um href, preservando querystring e
 * fragmento já existentes — o CTA do detalhe de produto, por exemplo, já
 * chega como `/pt/contato?produto=slug&assunto=quote`.
 *
 * Regras (todas cobertas por teste):
 *  - origem ausente/inválida → href intocado;
 *  - href sem caminho (`#ancora`, `""`) → intocado (parâmetro em fragmento
 *    puro nunca chegaria ao servidor);
 *  - href que JÁ tem `origem=` → intocado (o primeiro emissor vence; não
 *    duplicamos o parâmetro);
 *  - fragmento preservado no fim (`/pt/contato#form` →
 *    `/pt/contato?origem=menu#form`), senão o parâmetro viraria parte do
 *    fragmento e o servidor nunca o veria.
 *
 * NÃO decide se o destino MERECE a origem — quem decide é
 * `resolveDestination` (`@/core/config/site`), que só anexa quando o
 * destino resolvido é a página interna de contato ou de catálogo (nunca uma
 * URL externa configurada por env).
 */
export function withLeadOrigin(href: string, origin: LeadOrigin | null | undefined): string {
  if (typeof href !== "string" || href === "") return href;
  const normalized = normalizeLeadOrigin(origin);
  if (!normalized) return href;

  const hashIndex = href.indexOf("#");
  const beforeHash = hashIndex === -1 ? href : href.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : href.slice(hashIndex);

  // Fragmento puro (`#catalogo`, `#form`): não há caminho onde pendurar uma
  // querystring que o servidor leia.
  if (beforeHash === "") return href;

  const queryIndex = beforeHash.indexOf("?");
  const path = queryIndex === -1 ? beforeHash : beforeHash.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : beforeHash.slice(queryIndex + 1);

  if (hasQueryParam(query, LEAD_ORIGIN_PARAM)) return href;

  const param = `${LEAD_ORIGIN_PARAM}=${normalized}`;
  const nextQuery = query ? `${query}&${param}` : param;
  return `${path}?${nextQuery}${hash}`;
}

/**
 * Se a querystring já declara um parâmetro. Comparação por chave crua (sem
 * `decodeURIComponent`): `URIError` em entrada malformada já derrubou uma
 * página desta base antes (ver `resolveCategoryCardHref` em
 * `@/modules/home/lib/category-cards`), e href de dicionário/banco é entrada
 * NÃO confiável.
 */
function hasQueryParam(query: string, param: string): boolean {
  if (!query) return false;
  return query
    .split("&")
    .some((part) => part.split("=")[0] === param);
}

/**
 * Cookie de primeira parte que carrega a campanha externa entre o pouso e o
 * formulário.
 *
 * PORQUÊ: a UTM chega na URL de ENTRADA (o anúncio aponta para a home, para
 * `/produtos`, para um produto), mas só é lida na página do formulário — e
 * nenhum link interno propaga querystring (`resolveDestination`/`siteNavLinks`
 * montam caminhos limpos; o redirect de locale do `proxy.ts` chega a descartar
 * a querystring inteira). Sem persistir, `utm_source`/`utm_medium`/
 * `utm_campaign` só sobreviveriam no caso em que o anúncio aponta DIRETO para
 * `/{locale}/contato` ou `/{locale}/catalogo` — ou seja, praticamente nunca —
 * e o marketing concluiria que a integração com o RD Station está quebrada.
 *
 * Gravado pelo `proxy.ts` (middleware) e lido pelas duas páginas de captura.
 * `httpOnly` de propósito: nada no client precisa dele, e o servidor continua
 * sendo a única autoridade sobre o valor. Sem dado pessoal — só o rótulo de
 * campanha que o próprio anunciante colocou na URL.
 */
export const UTM_COOKIE = "roco_utm";

/** Validade do cookie de campanha (30 dias, igual ao `NEXT_LOCALE`). */
export const UTM_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** Campanha capturada da URL/cookie, já saneada. */
export type CapturedUtm = Partial<Record<(typeof UTM_PARAMS)[number], string>>;

/**
 * Lê os três parâmetros de campanha de uma fonte qualquer (querystring do
 * middleware, objeto do cookie) e devolve só os que sobrevivem a
 * `normalizeUtmValue`. Objeto VAZIO quando não há campanha — o caller usa
 * isso para não sobrescrever uma campanha anterior com nada.
 */
export function captureUtm(read: (param: string) => unknown): CapturedUtm {
  const captured: CapturedUtm = {};
  for (const param of UTM_PARAMS) {
    const value = normalizeUtmValue(read(param));
    if (value) captured[param] = value;
  }
  return captured;
}

/**
 * Lê o cookie de campanha. NUNCA lança: cookie corrompido, truncado ou
 * forjado à mão vira `{}` — e o conteúdo passa pelo mesmo saneamento da
 * querystring, porque um cookie é entrada tão não confiável quanto a URL.
 */
export function readUtmCookie(raw: string | undefined | null): CapturedUtm {
  if (typeof raw !== "string" || raw === "") return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    return captureUtm((param) => (parsed as Record<string, unknown>)[param]);
  } catch {
    return {};
  }
}

/** Serializa a campanha para o cookie. `null` quando não há nada a gravar. */
export function serializeUtmCookie(captured: CapturedUtm): string | null {
  return Object.keys(captured).length > 0 ? JSON.stringify(captured) : null;
}
