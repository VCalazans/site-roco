import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  JSON_RPC_ERRORS,
  LATEST_PROTOCOL_VERSION,
  MAX_BATCH_SIZE,
  SUPPORTED_PROTOCOL_VERSIONS,
  ToolInputError,
  handleMcpBody,
  type McpServer,
  type McpTool,
} from "./mcp-protocol";

const ok: McpTool = {
  name: "dados",
  title: "Dados",
  description: "Devolve um objeto",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  annotations: { readOnlyHint: true },
  run: async (args) => ({ recebi: args, total: 2 }),
};

const lista: McpTool = {
  name: "lista",
  description: "Devolve uma lista",
  inputSchema: { type: "object" },
  run: async () => [1, 2, 3],
};

const recusa: McpTool = {
  name: "recusa",
  description: "Recusa a entrada",
  inputSchema: { type: "object" },
  run: async () => {
    throw new ToolInputError("Argumentos inválidos — slug: obrigatório");
  },
};

const quebra: McpTool = {
  name: "quebra",
  description: "Quebra por dentro",
  inputSchema: { type: "object" },
  run: async () => {
    throw new Error("SELECT * FROM products WHERE secret = 'x'");
  },
};

function makeServer(tools: McpTool[] = [ok, lista, recusa, quebra]): McpServer {
  return {
    info: { name: "roco", title: "ROCO", version: "1.0.0" },
    instructions: "Instruções de teste",
    tools: async () => tools,
  };
}

async function call(body: unknown, server = makeServer()) {
  return handleMcpBody(typeof body === "string" ? body : JSON.stringify(body), server);
}

describe("mcp-protocol", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  describe("erros de envelope HTTP", () => {
    it("JSON inválido → 400 com -32700 e id null", async () => {
      const result = await call("{ isto não é json");
      expect(result.status).toBe(400);
      expect(result.body).toEqual({
        jsonrpc: "2.0",
        id: null,
        error: { code: JSON_RPC_ERRORS.parse, message: "Parse error" },
      });
    });

    it("lote vazio → 400 com -32600", async () => {
      const result = await call([]);
      expect(result.status).toBe(400);
      expect(result.body).toMatchObject({ id: null, error: { code: -32600 } });
    });

    it(`lote com ${MAX_BATCH_SIZE + 1} mensagens → 400 com -32600`, async () => {
      const batch = Array.from({ length: MAX_BATCH_SIZE + 1 }, (_, i) => ({ jsonrpc: "2.0", id: i, method: "ping" }));
      const result = await call(batch);
      expect(result.status).toBe(400);
      expect(result.body).toMatchObject({ error: { code: -32600 } });
    });

    it(`lote com exatamente ${MAX_BATCH_SIZE} mensagens é aceito`, async () => {
      const batch = Array.from({ length: MAX_BATCH_SIZE }, (_, i) => ({ jsonrpc: "2.0", id: i, method: "ping" }));
      const result = await call(batch);
      expect(result.status).toBe(200);
      expect(result.body).toHaveLength(MAX_BATCH_SIZE);
    });

    it("só notificação → 202 sem corpo", async () => {
      const result = await call({ jsonrpc: "2.0", method: "notifications/initialized" });
      expect(result).toEqual({ status: 202 });
      expect(result.body).toBeUndefined();
    });

    it("lote só de notificações → 202 sem corpo", async () => {
      const result = await call([
        { jsonrpc: "2.0", method: "notifications/initialized" },
        { jsonrpc: "2.0", method: "notifications/cancelled" },
      ]);
      expect(result).toEqual({ status: 202 });
    });

    it("lote misto (notificação + request) → só a resposta do request", async () => {
      const result = await call([
        { jsonrpc: "2.0", method: "notifications/initialized" },
        { jsonrpc: "2.0", id: 7, method: "ping" },
      ]);
      expect(result.status).toBe(200);
      expect(result.body).toEqual([{ jsonrpc: "2.0", id: 7, result: {} }]);
    });

    it("jsonrpc diferente de '2.0' → 400", async () => {
      const result = await call({ jsonrpc: "1.0", id: 1, method: "ping" });
      expect(result.status).toBe(400);
      expect(result.body).toMatchObject({ id: 1, error: { code: -32600 } });
    });

    it("id objeto → 400 com -32600 e id null", async () => {
      const result = await call({ jsonrpc: "2.0", id: { a: 1 }, method: "ping" });
      expect(result.status).toBe(400);
      expect(result.body).toMatchObject({ id: null, error: { code: -32600 } });
    });

    it("mensagem sem method (não notificação) → 400 -32600", async () => {
      const result = await call({ jsonrpc: "2.0", id: 3 });
      expect(result.status).toBe(400);
      expect(result.body).toMatchObject({ id: 3, error: { code: -32600 } });
    });
  });

  describe("initialize e ping", () => {
    it("devolve a versão pedida quando é suportada", async () => {
      for (const version of SUPPORTED_PROTOCOL_VERSIONS) {
        const result = await call({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: { protocolVersion: version },
        });
        expect(result.body).toMatchObject({ result: { protocolVersion: version } });
      }
    });

    it("versão desconhecida → LATEST_PROTOCOL_VERSION", async () => {
      const result = await call({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "1999-01-01" },
      });
      expect(result.body).toMatchObject({ result: { protocolVersion: LATEST_PROTOCOL_VERSION } });
    });

    it("sem params → versão mais nova", async () => {
      const result = await call({ jsonrpc: "2.0", id: 1, method: "initialize" });
      expect(result.body).toMatchObject({ result: { protocolVersion: LATEST_PROTOCOL_VERSION } });
    });

    it("traz capabilities.tools, serverInfo e instructions", async () => {
      const result = await call({ jsonrpc: "2.0", id: "abc", method: "initialize", params: {} });
      expect(result.body).toEqual({
        jsonrpc: "2.0",
        id: "abc",
        result: {
          protocolVersion: LATEST_PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "roco", title: "ROCO", version: "1.0.0" },
          instructions: "Instruções de teste",
        },
      });
    });

    it("ping → result {}", async () => {
      const result = await call({ jsonrpc: "2.0", id: 9, method: "ping" });
      expect(result.body).toEqual({ jsonrpc: "2.0", id: 9, result: {} });
    });
  });

  describe("tools/list", () => {
    it("lista as definições sem a função run", async () => {
      const result = await call({ jsonrpc: "2.0", id: 2, method: "tools/list" });
      const body = result.body as { result: { tools: Record<string, unknown>[] } };
      expect(body.result.tools.map((tool) => tool.name)).toEqual(["dados", "lista", "recusa", "quebra"]);
      for (const tool of body.result.tools) {
        expect(tool).not.toHaveProperty("run");
      }
      expect(body.result.tools[0]).toEqual({
        name: "dados",
        title: "Dados",
        description: "Devolve um objeto",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true },
      });
    });

    it("ferramenta sem title/annotations não traz essas chaves", async () => {
      const result = await call({ jsonrpc: "2.0", id: 2, method: "tools/list" });
      const tool = (result.body as { result: { tools: Record<string, unknown>[] } }).result.tools[1];
      expect(tool).not.toHaveProperty("title");
      expect(tool).not.toHaveProperty("annotations");
    });
  });

  describe("tools/call", () => {
    it("resultado OK: content em texto JSON + structuredContent para objetos", async () => {
      const result = await call({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "dados", arguments: { a: 1 } },
      });
      expect(result.body).toEqual({
        jsonrpc: "2.0",
        id: 4,
        result: {
          content: [{ type: "text", text: JSON.stringify({ recebi: { a: 1 }, total: 2 }, null, 2) }],
          structuredContent: { recebi: { a: 1 }, total: 2 },
          isError: false,
        },
      });
    });

    it("sem arguments usa objeto vazio", async () => {
      const result = await call({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "dados" } });
      expect(result.body).toMatchObject({ result: { structuredContent: { recebi: {} } } });
    });

    it("resultado que é lista não ganha structuredContent", async () => {
      const result = await call({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "lista" } });
      const body = result.body as { result: Record<string, unknown> };
      expect(body.result).not.toHaveProperty("structuredContent");
      expect(body.result).toMatchObject({ isError: false, content: [{ type: "text", text: "[\n  1,\n  2,\n  3\n]" }] });
    });

    it("ToolInputError vira resultado com isError true (não erro de protocolo)", async () => {
      const result = await call({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "recusa" } });
      expect(result.body).toEqual({
        jsonrpc: "2.0",
        id: 6,
        result: {
          content: [{ type: "text", text: "Argumentos inválidos — slug: obrigatório" }],
          isError: true,
        },
      });
    });

    it("erro comum → -32603 'Internal error', sem vazar a mensagem, e loga só o tipo", async () => {
      const result = await call({ jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "quebra" } });
      expect(result.status).toBe(200);
      expect(result.body).toEqual({
        jsonrpc: "2.0",
        id: 8,
        error: { code: JSON_RPC_ERRORS.internal, message: "Internal error" },
      });
      expect(JSON.stringify(result.body)).not.toContain("SELECT");
      expect(errorSpy).toHaveBeenCalled();
      const logged = errorSpy.mock.calls.flat().join(" ");
      expect(logged).not.toContain("SELECT");
      expect(logged).toContain("Error");
    });

    it("ferramenta inexistente → -32602", async () => {
      const result = await call({ jsonrpc: "2.0", id: 10, method: "tools/call", params: { name: "nao-existe" } });
      expect(result.body).toMatchObject({ id: 10, error: { code: JSON_RPC_ERRORS.invalidParams } });
    });

    it("name ausente → -32602", async () => {
      const result = await call({ jsonrpc: "2.0", id: 10, method: "tools/call", params: {} });
      expect(result.body).toMatchObject({ error: { code: JSON_RPC_ERRORS.invalidParams } });
    });

    it("arguments que não é objeto → -32602", async () => {
      const result = await call({
        jsonrpc: "2.0",
        id: 11,
        method: "tools/call",
        params: { name: "dados", arguments: ["x"] },
      });
      expect(result.body).toMatchObject({ error: { code: JSON_RPC_ERRORS.invalidParams } });
    });
  });

  describe("método desconhecido", () => {
    it("→ -32601 'Method not found'", async () => {
      const result = await call({ jsonrpc: "2.0", id: 12, method: "resources/list" });
      expect(result.status).toBe(200);
      expect(result.body).toEqual({
        jsonrpc: "2.0",
        id: 12,
        error: { code: JSON_RPC_ERRORS.methodNotFound, message: "Method not found" },
      });
    });
  });

  describe("erro ao listar ferramentas", () => {
    it("falha em server.tools() vira -32603 sem detalhes", async () => {
      const server: McpServer = {
        ...makeServer(),
        tools: async () => {
          throw new Error("conexão recusada em 10.0.0.5");
        },
      };
      const result = await call({ jsonrpc: "2.0", id: 13, method: "tools/list" }, server);
      expect(result.body).toEqual({
        jsonrpc: "2.0",
        id: 13,
        error: { code: JSON_RPC_ERRORS.internal, message: "Internal error" },
      });
      expect(JSON.stringify(result.body)).not.toContain("10.0.0.5");
    });
  });
});

describe("countMcpMessages", () => {
  it("conta 1 para mensagem única e para JSON inválido", async () => {
    const { countMcpMessages } = await import("@/modules/ai/lib/mcp-protocol");
    expect(countMcpMessages('{"jsonrpc":"2.0","id":1,"method":"ping"}')).toBe(1);
    expect(countMcpMessages("not json")).toBe(1);
  });

  it("conta cada mensagem do lote, limitado ao teto do lote", async () => {
    const { countMcpMessages, MAX_BATCH_SIZE } = await import("@/modules/ai/lib/mcp-protocol");
    expect(countMcpMessages(JSON.stringify([{}, {}, {}]))).toBe(3);
    expect(countMcpMessages(JSON.stringify(Array.from({ length: 50 }, () => ({}))))).toBe(MAX_BATCH_SIZE);
    expect(countMcpMessages("[]")).toBe(1);
  });
});
