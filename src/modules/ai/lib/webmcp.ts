import { withLeadOrigin } from "@/shared/lib/lead-origin";

/**
 * Ferramentas WebMCP do site público (spec 003) — lógica PURA, testável sem
 * navegador: as dependências (fetch, navegação, orçamento) são injetadas pelo
 * componente `WebMcpTools`.
 *
 * Contrato da API (Chrome, origin trial, 2026): `document.modelContext
 * .registerTool(tool, { signal })`; `execute(input)` devolve texto.
 */

export type WebMcpAnnotations = {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
  consequentialHint?: boolean;
};

export type WebMcpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: WebMcpAnnotations;
  execute: (input: unknown) => Promise<string>;
};

type ModelContext = {
  registerTool: (
    tool: WebMcpTool,
    options?: { signal?: AbortSignal }
  ) => Promise<{ unregister?: () => void } | undefined> | { unregister?: () => void } | undefined;
};

/** `document.modelContext` (atual) ou `navigator.modelContext` (nome antigo). */
export function getModelContext(): ModelContext | null {
  if (typeof document === "undefined") return null;
  const candidate =
    (document as unknown as { modelContext?: ModelContext }).modelContext ??
    (typeof navigator !== "undefined" ? (navigator as unknown as { modelContext?: ModelContext }).modelContext : undefined);
  return candidate && typeof candidate.registerTool === "function" ? candidate : null;
}

export type QuoteItem = { slug: string; name: string; sku: string; quantity: number };

export type WebMcpDeps = {
  locale: string;
  productsPath: string;
  contactPath: string;
  quotePath: string;
  fetchJson: (url: string) => Promise<unknown>;
  navigate: (href: string) => void;
  addToQuote: (item: { slug: string; name: string; sku: string; image?: string }, quantity: number) => boolean;
  readQuote: () => readonly QuoteItem[];
};

const MAX_RESULTS = 20;
const MAX_QUANTITY = 9999;
const AI_ORIGIN = "assistente-ia" as const;

/** Algumas versões entregavam os argumentos como JSON em texto. */
function readInput(input: unknown): Record<string, unknown> {
  if (typeof input === "string") {
    try {
      const parsed: unknown = JSON.parse(input);
      return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof input === "object" && input !== null && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function stringList(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => text(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

/** Slug do catálogo: minúsculas, dígitos e hífen. Qualquer outra coisa não vira URL. */
export function isCatalogSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 200;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(number)));
}

type ApiProduct = {
  slug: string;
  sku: string;
  namePt: string;
  nameEn: string | null;
  bestSeller?: boolean;
  categories?: { slug: string; namePt: string; nameEn: string | null }[];
  images?: { url: string }[];
};

function nameOf(product: ApiProduct, locale: string): string {
  return (locale === "en" && product.nameEn) || product.namePt;
}

/** Querystring da listagem (mesma convenção da página: parâmetros repetidos). */
export function listingQuery(input: { terms: string[]; categories: string[]; bestSeller: boolean; perPage?: number }): string {
  const params = new URLSearchParams();
  for (const term of input.terms) params.append("search", term);
  for (const category of input.categories) params.append("category", category);
  if (input.bestSeller) params.set("bestSeller", "1");
  if (input.perPage) params.set("perPage", String(input.perPage));
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function buildWebMcpTools(deps: WebMcpDeps): WebMcpTool[] {
  const productHref = (slug: string) => `${deps.productsPath}/${slug}`;

  return [
    {
      name: "buscar_produtos",
      description:
        "Busca no catálogo da ROCO (hidrossanitários, hidráulica, conexões, gás, flexíveis) por palavras ou código (SKU), categorias e campeões de vendas. Devolve SKU, nome, slug e link. A ROCO não divulga preços.",
      inputSchema: {
        type: "object",
        properties: {
          termos: { type: "array", items: { type: "string", maxLength: 60 }, maxItems: 6, description: "Palavras ou SKU; todos precisam casar." },
          categorias: { type: "array", items: { type: "string" }, maxItems: 5, description: "Slugs de categoria (ex.: gas, flexiveis, conexoes)." },
          so_campeoes: { type: "boolean", description: "Só campeões de vendas." },
          limite: { type: "integer", minimum: 1, maximum: MAX_RESULTS },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      async execute(raw) {
        const input = readInput(raw);
        const terms = stringList(input.termos, 6, 60);
        const categories = stringList(input.categorias, 5, 80).filter(isCatalogSlug);
        const limit = clampInt(input.limite, 1, MAX_RESULTS, 10);
        const data = (await deps.fetchJson(
          `/api/products${listingQuery({ terms, categories, bestSeller: input.so_campeoes === true, perPage: limit })}`
        )) as { items?: ApiProduct[]; total?: number } | null;
        if (!data?.items) return "Não foi possível consultar o catálogo agora. Tente de novo em instantes.";
        return JSON.stringify({
          total: data.total ?? data.items.length,
          itens: data.items.map((product) => ({
            sku: product.sku,
            nome: nameOf(product, deps.locale),
            slug: product.slug,
            campeao_de_vendas: Boolean(product.bestSeller),
            url: productHref(product.slug),
          })),
        });
      },
    },
    {
      name: "abrir_produto",
      description: "Abre nesta aba a página de um produto da ROCO pelo slug (de buscar_produtos).",
      inputSchema: {
        type: "object",
        properties: { slug: { type: "string", maxLength: 200 } },
        required: ["slug"],
        additionalProperties: false,
      },
      async execute(raw) {
        const slug = text(readInput(raw).slug, 200);
        if (!isCatalogSlug(slug)) return "Slug inválido. Use buscar_produtos para obter o slug.";
        deps.navigate(productHref(slug));
        return `Abrindo ${productHref(slug)}.`;
      },
    },
    {
      name: "filtrar_catalogo",
      description: "Mostra nesta aba a listagem de produtos da ROCO com os filtros (termos, categorias, só campeões).",
      inputSchema: {
        type: "object",
        properties: {
          termos: { type: "array", items: { type: "string", maxLength: 60 }, maxItems: 5 },
          categorias: { type: "array", items: { type: "string" }, maxItems: 5 },
          so_campeoes: { type: "boolean" },
        },
        additionalProperties: false,
      },
      async execute(raw) {
        const input = readInput(raw);
        const href = `${deps.productsPath}${listingQuery({
          terms: stringList(input.termos, 5, 60),
          categories: stringList(input.categorias, 5, 80).filter(isCatalogSlug),
          bestSeller: input.so_campeoes === true,
        })}`;
        deps.navigate(href);
        return `Abrindo ${href}.`;
      },
    },
    {
      name: "adicionar_ao_orcamento",
      description:
        "Adiciona um produto à lista \"Meu orçamento\" deste navegador (não envia nada). A pessoa revisa e envia a lista na página do orçamento.",
      inputSchema: {
        type: "object",
        properties: {
          slug: { type: "string", maxLength: 200 },
          quantidade: { type: "integer", minimum: 1, maximum: MAX_QUANTITY },
        },
        required: ["slug"],
        additionalProperties: false,
      },
      annotations: { consequentialHint: false },
      async execute(raw) {
        const input = readInput(raw);
        const slug = text(input.slug, 200);
        if (!isCatalogSlug(slug)) return "Slug inválido. Use buscar_produtos para obter o slug.";
        const product = (await deps.fetchJson(`/api/products/${slug}`)) as ApiProduct | null;
        if (!product?.slug) return "Produto não encontrado no catálogo público.";
        const quantity = clampInt(input.quantidade, 1, MAX_QUANTITY, 1);
        const added = deps.addToQuote(
          { slug: product.slug, sku: product.sku, name: nameOf(product, deps.locale), image: product.images?.[0]?.url },
          quantity
        );
        return added
          ? `${nameOf(product, deps.locale)} (${quantity}) adicionado ao orçamento. Revise e envie em ${deps.quotePath}.`
          : "Não foi possível adicionar: a lista de orçamento atingiu o limite de itens.";
      },
    },
    {
      name: "ver_orcamento",
      description: "Lista os itens da lista \"Meu orçamento\" deste navegador.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      async execute() {
        const items = deps.readQuote();
        return JSON.stringify({
          itens: items.map((item) => ({ sku: item.sku, nome: item.name, slug: item.slug, quantidade: item.quantity })),
          pagina: deps.quotePath,
        });
      },
    },
    {
      name: "preparar_contato",
      description:
        "Abre o formulário de contato da ROCO nesta aba, já com o assunto (e o produto, se informado). NÃO envia: a pessoa preenche os dados, confirma o consentimento e envia.",
      inputSchema: {
        type: "object",
        properties: {
          assunto: { type: "string", enum: ["quote", "call_back", "general"], description: "quote = orçamento; call_back = pedir ligação; general = dúvida geral." },
          slug: { type: "string", maxLength: 200, description: "Produto de interesse (opcional)." },
        },
        additionalProperties: false,
      },
      async execute(raw) {
        const input = readInput(raw);
        const subject = ["quote", "call_back", "general"].includes(String(input.assunto)) ? String(input.assunto) : "quote";
        const slug = text(input.slug, 200);
        const params = new URLSearchParams({ assunto: subject });
        if (slug && isCatalogSlug(slug)) params.set("produto", slug);
        const href = withLeadOrigin(`${deps.contactPath}?${params.toString()}`, AI_ORIGIN);
        deps.navigate(href);
        return `Formulário aberto em ${href}. A pessoa precisa preencher e enviar.`;
      },
    },
  ];
}
