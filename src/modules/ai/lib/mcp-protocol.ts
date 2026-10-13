/**
 * Servidor MCP público da ROCO — camada de PROTOCOLO (spec 003).
 *
 * Streamable HTTP em modo stateless com respostas JSON: cada POST traz uma
 * mensagem JSON-RPC 2.0 (ou um lote) e recebe a resposta no mesmo corpo —
 * sem SSE, sem sessão, sem `Mcp-Session-Id`. Módulo PURO: não conhece HTTP
 * nem banco; quem chama entrega as ferramentas e converte o resultado.
 */

/** Versões aceitas, da mais nova para a mais antiga. */
export const SUPPORTED_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"] as const;
export const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

/** Teto de mensagens num lote. */
export const MAX_BATCH_SIZE = 10;

export const JSON_RPC_ERRORS = {
  parse: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internal: -32603,
} as const;

export type ToolAnnotations = {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
};

export type ToolDefinition = {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: ToolAnnotations;
};

/** Erro de entrada do usuário: vira resultado com `isError` (o modelo pode corrigir), não erro de protocolo. */
export class ToolInputError extends Error {}

export type McpTool = ToolDefinition & {
  /** Recebe os argumentos crus; valida e devolve dados serializáveis em JSON. */
  run: (args: Record<string, unknown>) => Promise<unknown>;
};

export type McpServer = {
  info: { name: string; title: string; version: string; websiteUrl?: string };
  instructions: string;
  /** Lista resolvida na hora (enums de categorias vêm do catálogo). */
  tools: () => Promise<McpTool[]>;
};

type JsonRpcId = string | number | null;

type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: JsonRpcId; result: unknown }
  | { jsonrpc: "2.0"; id: JsonRpcId; error: { code: number; message: string; data?: unknown } };

/** Resultado da camada HTTP: status + corpo (sem corpo = 202 Accepted). */
export type McpHttpResult = { status: number; body?: JsonRpcResponse | JsonRpcResponse[] };

function errorResponse(id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: data === undefined ? { code, message } : { code, message, data } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validId(value: unknown): value is string | number {
  return typeof value === "string" || (typeof value === "number" && Number.isFinite(value));
}

export function negotiateProtocolVersion(requested: unknown): string {
  return typeof requested === "string" && (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
    ? requested
    : LATEST_PROTOCOL_VERSION;
}

/** Definição pública da ferramenta (sem a função `run`). */
export function definitionOf(tool: McpTool): ToolDefinition {
  return {
    name: tool.name,
    ...(tool.title ? { title: tool.title } : {}),
    description: tool.description,
    inputSchema: tool.inputSchema,
    ...(tool.annotations ? { annotations: tool.annotations } : {}),
  };
}

function toolResult(data: unknown) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    // Clientes 2025-06-18+ leem o objeto direto; os antigos ignoram o campo.
    ...(isRecord(data) ? { structuredContent: data } : {}),
    isError: false,
  };
}

async function handleMessage(message: unknown, server: McpServer): Promise<JsonRpcResponse | null> {
  if (!isRecord(message) || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    const id = isRecord(message) && validId(message.id) ? message.id : null;
    return errorResponse(id, JSON_RPC_ERRORS.invalidRequest, "Invalid Request");
  }

  const isNotification = !("id" in message);
  if (!isNotification && !validId(message.id)) {
    return errorResponse(null, JSON_RPC_ERRORS.invalidRequest, "Invalid Request: id must be a string or number");
  }
  const id = isNotification ? null : (message.id as string | number);
  const params = isRecord(message.params) ? message.params : {};

  // Notificações (`notifications/initialized`, `notifications/cancelled`…) não
  // têm resposta. Nada aqui tem efeito colateral, então só são aceitas.
  if (isNotification) return null;

  try {
    switch (message.method) {
      case "initialize":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: negotiateProtocolVersion(params.protocolVersion),
            capabilities: { tools: { listChanged: false } },
            serverInfo: server.info,
            instructions: server.instructions,
          },
        };
      case "ping":
        return { jsonrpc: "2.0", id, result: {} };
      case "tools/list": {
        const tools = await server.tools();
        return {
          jsonrpc: "2.0",
          id,
          result: { tools: tools.map(definitionOf) },
        };
      }
      case "tools/call": {
        if (typeof params.name !== "string") {
          return errorResponse(id, JSON_RPC_ERRORS.invalidParams, "Invalid params: name is required");
        }
        const tool = (await server.tools()).find((candidate) => candidate.name === params.name);
        if (!tool) {
          return errorResponse(id, JSON_RPC_ERRORS.invalidParams, `Unknown tool: ${params.name.slice(0, 80)}`);
        }
        const args = params.arguments === undefined ? {} : params.arguments;
        if (!isRecord(args)) {
          return errorResponse(id, JSON_RPC_ERRORS.invalidParams, "Invalid params: arguments must be an object");
        }
        try {
          return { jsonrpc: "2.0", id, result: toolResult(await tool.run(args)) };
        } catch (error) {
          if (error instanceof ToolInputError) {
            return {
              jsonrpc: "2.0",
              id,
              result: { content: [{ type: "text", text: error.message }], isError: true },
            };
          }
          throw error;
        }
      }
      default:
        return errorResponse(id, JSON_RPC_ERRORS.methodNotFound, "Method not found");
    }
  } catch (error) {
    // Nunca stack trace nem mensagem de banco para fora — só o código.
    console.error("[mcp] erro interno em", message.method, error instanceof Error ? error.name : "unknown");
    return errorResponse(id, JSON_RPC_ERRORS.internal, "Internal error");
  }
}

/**
 * Quantas mensagens o corpo carrega (o limite por IP cobra por mensagem).
 * JSON inválido conta 1 — a resposta de erro também custa.
 */
export function countMcpMessages(text: string): number {
  try {
    const payload: unknown = JSON.parse(text);
    return Array.isArray(payload) ? Math.min(Math.max(payload.length, 1), MAX_BATCH_SIZE) : 1;
  } catch {
    return 1;
  }
}

/**
 * Corpo JSON já lido (texto) → resposta HTTP. JSON inválido = -32700 (400);
 * lote vazio ou grande demais = -32600 (400); só notificações = 202 sem corpo.
 */
export async function handleMcpBody(text: string, server: McpServer): Promise<McpHttpResult> {
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return { status: 400, body: errorResponse(null, JSON_RPC_ERRORS.parse, "Parse error") };
  }

  if (Array.isArray(payload)) {
    if (payload.length === 0 || payload.length > MAX_BATCH_SIZE) {
      return {
        status: 400,
        body: errorResponse(null, JSON_RPC_ERRORS.invalidRequest, `Invalid Request: batch must have 1-${MAX_BATCH_SIZE} messages`),
      };
    }
    const responses: JsonRpcResponse[] = [];
    // Em sequência, não em paralelo: um lote de 20 buscas não vira 20 consultas simultâneas.
    for (const message of payload) {
      const response = await handleMessage(message, server);
      if (response) responses.push(response);
    }
    return responses.length > 0 ? { status: 200, body: responses } : { status: 202 };
  }

  const response = await handleMessage(payload, server);
  if (!response) return { status: 202 };
  const invalid = "error" in response && response.error.code === JSON_RPC_ERRORS.invalidRequest;
  return { status: invalid ? 400 : 200, body: response };
}
