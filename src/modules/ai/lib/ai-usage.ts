/**
 * Métricas de uso da IA — regras PURAS (sem I/O). Tudo aqui vira contador
 * diário em `ai_usage_daily`; por isso só existem chaves de listas fechadas:
 * nome de cliente MCP, nome de ferramenta e página são classificados antes de
 * gravar, e o que não se encaixa vira `other` (ou é ignorado).
 *
 * O que NÃO dá para medir: quantas pessoas têm o conector instalado. O conector
 * fica na conta do Claude/ChatGPT de cada um, e as chamadas chegam dos
 * servidores da Anthropic/OpenAI, sem identificar a pessoa. `connection` conta
 * conversas que usaram o conector (cada uma começa com `initialize`).
 */

export const AI_USAGE_METRICS = ["connection", "tool", "connect_click", "quote_link"] as const;
export type AiUsageMetric = (typeof AI_USAGE_METRICS)[number];

export type AiUsageEvent = { metric: AiUsageMetric; key: string; count?: number };

export const MCP_CLIENTS = ["claude", "chatgpt", "perplexity", "cursor", "vscode", "other"] as const;
export type McpClient = (typeof MCP_CLIENTS)[number];

/** Ferramentas do servidor MCP (`mcp-tools.ts`); nome fora desta lista não é contado. */
export const MCP_TOOL_NAMES = [
  "sobre_roco",
  "como_comprar",
  "listar_categorias",
  "buscar_produtos",
  "obter_produto",
  "montar_orcamento",
] as const;

/** Páginas com o botão "Conectar ao Claude". */
export const CONNECT_CLICK_SOURCES = ["home", "ia"] as const;
export type ConnectClickSource = (typeof CONNECT_CLICK_SOURCES)[number];

const CLIENT_PATTERNS: ReadonlyArray<[McpClient, RegExp]> = [
  ["chatgpt", /openai|chatgpt/i],
  ["claude", /claude|anthropic/i],
  ["perplexity", /perplexity/i],
  ["cursor", /cursor/i],
  ["vscode", /visual studio code|vscode|vs code|copilot/i],
];

/** `clientInfo.name` do `initialize` → IA conhecida ou `other`. */
export function classifyMcpClient(name: unknown): McpClient {
  if (typeof name !== "string" || !name.trim()) return "other";
  const value = name.slice(0, 200);
  return CLIENT_PATTERNS.find(([, pattern]) => pattern.test(value))?.[0] ?? "other";
}

/** Rota que conta o clique e redireciona ao link oficial de instalação do Claude. */
export const CLAUDE_CONNECT_ROUTE = "/api/ai/conectar-claude";

export function claudeConnectHref(source: ConnectClickSource): string {
  return `${CLAUDE_CONNECT_ROUTE}?de=${source}`;
}

export function normalizeConnectSource(value: unknown): ConnectClickSource {
  return value === "home" ? "home" : "ia";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Ids das respostas que falharam (erro de protocolo ou resultado com `isError`). */
function failedResponseIds(responseBody: unknown): Set<unknown> {
  const failed = new Set<unknown>();
  const responses = Array.isArray(responseBody) ? responseBody : responseBody ? [responseBody] : [];
  for (const response of responses) {
    if (!isRecord(response)) continue;
    const result = isRecord(response.result) ? response.result : undefined;
    if (response.error !== undefined || result?.isError === true) failed.add(response.id);
  }
  return failed;
}

/**
 * Eventos de uso de um corpo do `/mcp` (mensagem única ou lote). JSON inválido
 * não conta nada; `tools/call` de ferramenta desconhecida é ignorado, e, com a
 * resposta em mãos, a chamada que falhou (argumento inválido) também.
 */
export function extractMcpUsageEvents(bodyText: string, responseBody?: unknown): AiUsageEvent[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return [];
  }
  const messages = Array.isArray(parsed) ? parsed : [parsed];
  const failed = failedResponseIds(responseBody);
  const events: AiUsageEvent[] = [];
  for (const message of messages) {
    if (!isRecord(message) || typeof message.method !== "string") continue;
    const params = isRecord(message.params) ? message.params : {};
    if (message.method === "initialize") {
      const clientInfo = isRecord(params.clientInfo) ? params.clientInfo : {};
      events.push({ metric: "connection", key: classifyMcpClient(clientInfo.name) });
    } else if (message.method === "tools/call") {
      const name = params.name;
      if (failed.has(message.id)) continue;
      if (typeof name === "string" && (MCP_TOOL_NAMES as readonly string[]).includes(name)) {
        events.push({ metric: "tool", key: name });
      }
    }
  }
  return mergeEvents(events);
}

/** Soma eventos iguais (um lote vira uma escrita por chave). */
export function mergeEvents(events: AiUsageEvent[]): AiUsageEvent[] {
  const totals = new Map<string, AiUsageEvent>();
  for (const event of events) {
    const id = `${event.metric}\u0000${event.key}`;
    const current = totals.get(id);
    const amount = event.count ?? 1;
    if (current) current.count = (current.count ?? 1) + amount;
    else totals.set(id, { metric: event.metric, key: event.key, count: amount });
  }
  return [...totals.values()];
}

export type AiUsageRow = { metric: string; key: string; total: number };

export type AiUsageTotals = {
  connections: Record<McpClient, number>;
  totalConnections: number;
  tools: Record<(typeof MCP_TOOL_NAMES)[number], number>;
  totalToolCalls: number;
  connectClicks: Record<ConnectClickSource, number>;
  quoteLinksOpened: number;
};

/** Linhas agregadas do banco → totais com todas as chaves (zeros incluídos). */
export function summarizeAiUsage(rows: AiUsageRow[]): AiUsageTotals {
  const connections = Object.fromEntries(MCP_CLIENTS.map((client) => [client, 0])) as AiUsageTotals["connections"];
  const tools = Object.fromEntries(MCP_TOOL_NAMES.map((tool) => [tool, 0])) as AiUsageTotals["tools"];
  const connectClicks = Object.fromEntries(
    CONNECT_CLICK_SOURCES.map((source) => [source, 0])
  ) as AiUsageTotals["connectClicks"];
  let quoteLinksOpened = 0;

  for (const row of rows) {
    const total = Number(row.total) || 0;
    if (row.metric === "connection" && row.key in connections) connections[row.key as McpClient] += total;
    else if (row.metric === "tool" && row.key in tools) tools[row.key as keyof typeof tools] += total;
    else if (row.metric === "connect_click" && row.key in connectClicks)
      connectClicks[row.key as ConnectClickSource] += total;
    else if (row.metric === "quote_link") quoteLinksOpened += total;
  }

  const sum = (record: Record<string, number>) => Object.values(record).reduce((acc, value) => acc + value, 0);
  return {
    connections,
    totalConnections: sum(connections),
    tools,
    totalToolCalls: sum(tools),
    connectClicks,
    quoteLinksOpened,
  };
}
