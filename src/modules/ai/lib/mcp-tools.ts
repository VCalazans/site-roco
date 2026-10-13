import { z } from "zod";
import { ToolInputError, type McpTool } from "@/modules/ai/lib/mcp-protocol";

/**
 * Ferramentas do servidor MCP público (spec 003). Todas SOMENTE LEITURA, sobre
 * dados que o site já publica: nada de lead, representante, usuário, rascunho,
 * produto despublicado ou imagem "só no portal" (a fonte só enxerga o catálogo
 * público — `published && active`, imagens `show_on_site`).
 *
 * Puro: a fonte de dados é injetada (`CatalogSource`), então os testes rodam
 * sem banco.
 */

export const MCP_LOCALES = ["pt", "en"] as const;
export type McpLocale = (typeof MCP_LOCALES)[number];

/** Teto de resultados por busca. */
export const MAX_SEARCH_RESULTS = 20;
const DEFAULT_SEARCH_RESULTS = 10;
const MAX_TERMS = 6;
const MAX_TERM_LENGTH = 60;

export type ProductSummary = {
  sku: string;
  nome: string;
  categorias: string[];
  campeao_de_vendas: boolean;
  url: string;
  imagem?: string;
};

export type ProductDetail = ProductSummary & {
  descricao?: string;
  ean?: string;
  embalagens: { descricao: string; ean?: string }[];
  imagens: string[];
  categorias_detalhe: { slug: string; nome: string; url: string }[];
  solicitar_orcamento_url: string;
};

export interface CatalogSource {
  company(locale: McpLocale): Promise<Record<string, unknown>>;
  howToBuy(locale: McpLocale): Promise<Record<string, unknown>>;
  categories(locale: McpLocale): Promise<{ slug: string; nome: string; produtos: number; url: string }[]>;
  categorySlugs(): Promise<string[]>;
  search(input: {
    locale: McpLocale;
    terms: string[];
    categories: string[];
    bestSeller: boolean;
    limit: number;
  }): Promise<{ total: number; itens: ProductSummary[] }>;
  product(input: { locale: McpLocale; slug?: string; sku?: string }): Promise<ProductDetail | null>;
}

export const MCP_TOOL_NAMES = [
  "sobre_roco",
  "como_comprar",
  "listar_categorias",
  "buscar_produtos",
  "obter_produto",
] as const;

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

const localeField = z.enum(MCP_LOCALES).default("pt").describe("Idioma da resposta: pt (padrão) ou en.");

function jsonSchemaOf(schema: z.ZodType): Record<string, unknown> {
  const jsonSchema = { ...(z.toJSONSchema(schema, { io: "input" }) as Record<string, unknown>) };
  delete jsonSchema.$schema;
  return jsonSchema;
}

/** Valida argumentos; erro vira mensagem legível para o modelo corrigir. */
function parseArgs<T extends z.ZodType>(schema: T, args: Record<string, unknown>): z.output<T> {
  const parsed = schema.safeParse(args);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join(".") || "argumentos"}: ${issue.message}`)
      .join("; ");
    throw new ToolInputError(`Argumentos inválidos — ${issues}`);
  }
  return parsed.data;
}

export async function buildMcpTools(source: CatalogSource): Promise<McpTool[]> {
  const categorySlugs = await source.categorySlugs();
  const categoryField =
    categorySlugs.length > 0 ? z.enum(categorySlugs as [string, ...string[]]) : z.string().max(80);

  const localeOnly = z.strictObject({ idioma: localeField });

  const searchSchema = z.strictObject({
    termos: z
      .array(z.string().trim().min(1).max(MAX_TERM_LENGTH))
      .max(MAX_TERMS)
      .default([])
      .describe("Palavras ou códigos (SKU) a buscar; todos precisam casar. Sem acento e sem caixa. Ex.: [\"flexivel\", \"gas\"]."),
    categorias: z
      .array(categoryField)
      .max(5)
      .default([])
      .describe("Slugs de categoria (de listar_categorias); produto de qualquer uma delas."),
    so_campeoes: z.boolean().default(false).describe("Só os campeões de vendas."),
    limite: z.number().int().min(1).max(MAX_SEARCH_RESULTS).default(DEFAULT_SEARCH_RESULTS),
    idioma: localeField,
  });

  const productSchema = z
    .strictObject({
      slug: z
        .string()
        .trim()
        .max(200)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug inválido")
        .optional()
        .describe("Slug do produto (parte final da URL)."),
      sku: z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9._-]{1,40}$/, "SKU inválido")
        .optional()
        .describe("Código do produto (SKU)."),
      idioma: localeField,
    })
    .refine((value) => Boolean(value.slug || value.sku), { message: "informe slug ou sku" });

  return [
    {
      name: "sobre_roco",
      title: "Sobre a ROCO",
      description:
        "Dados oficiais da ROCO (Roco Indústria Metalplástica S.A.), fabricante brasileira de soluções hidrossanitárias e hidráulicas de Blumenau/Gaspar (SC): razão social, fundação, unidades, mercados, linhas de produto, certificações, contato comercial e aviso de homônimos.",
      inputSchema: jsonSchemaOf(localeOnly),
      annotations: { title: "Sobre a ROCO", ...READ_ONLY },
      run: async (args) => source.company(parseArgs(localeOnly, args).idioma),
    },
    {
      name: "como_comprar",
      title: "Como comprar da ROCO",
      description:
        "Como comprar ou pedir orçamento à ROCO (o site não tem preços nem checkout), catálogo online e como se tornar representante comercial. Devolve os links oficiais.",
      inputSchema: jsonSchemaOf(localeOnly),
      annotations: { title: "Como comprar", ...READ_ONLY },
      run: async (args) => source.howToBuy(parseArgs(localeOnly, args).idioma),
    },
    {
      name: "listar_categorias",
      title: "Categorias do catálogo",
      description: "Categorias do catálogo público da ROCO com a quantidade de produtos publicados e o link de cada uma.",
      inputSchema: jsonSchemaOf(localeOnly),
      annotations: { title: "Categorias", ...READ_ONLY },
      run: async (args) => ({ categorias: await source.categories(parseArgs(localeOnly, args).idioma) }),
    },
    {
      name: "buscar_produtos",
      title: "Buscar produtos",
      description:
        "Busca no catálogo público da ROCO por palavras, código (SKU), categorias e campeões de vendas. Devolve SKU, nome, categorias, link e imagem. Sem preços (a ROCO vende por orçamento).",
      inputSchema: jsonSchemaOf(searchSchema),
      annotations: { title: "Buscar produtos", ...READ_ONLY },
      run: async (args) => {
        const input = parseArgs(searchSchema, args);
        return source.search({
          locale: input.idioma,
          terms: input.termos,
          categories: input.categorias,
          bestSeller: input.so_campeoes,
          limit: input.limite,
        });
      },
    },
    {
      name: "obter_produto",
      title: "Detalhes do produto",
      description:
        "Ficha de um produto da ROCO por slug ou SKU: descrição, categorias, todas as embalagens com EAN, imagens, link da página e link para pedir orçamento.",
      inputSchema: jsonSchemaOf(productSchema),
      annotations: { title: "Detalhes do produto", ...READ_ONLY },
      run: async (args) => {
        const input = parseArgs(productSchema, args);
        const product = await source.product({ locale: input.idioma, slug: input.slug, sku: input.sku });
        if (!product) {
          throw new ToolInputError("Produto não encontrado no catálogo público. Use buscar_produtos para achar o slug ou o SKU.");
        }
        return product;
      },
    },
  ];
}
