import { describe, expect, it } from "vitest";
import {
  classifyMcpClient,
  claudeConnectHref,
  extractMcpUsageEvents,
  mergeEvents,
  normalizeConnectSource,
  summarizeAiUsage,
} from "@/modules/ai/lib/ai-usage";

describe("classifyMcpClient", () => {
  it("reconhece as IAs pelo clientInfo.name", () => {
    expect(classifyMcpClient("claude-ai")).toBe("claude");
    expect(classifyMcpClient("Anthropic/ClaudeAI")).toBe("claude");
    expect(classifyMcpClient("openai-mcp")).toBe("chatgpt");
    expect(classifyMcpClient("Perplexity")).toBe("perplexity");
    expect(classifyMcpClient("cursor-vscode")).toBe("cursor");
    expect(classifyMcpClient("Visual Studio Code")).toBe("vscode");
  });

  it("nome vazio, estranho ou ausente vira other", () => {
    expect(classifyMcpClient("mcp-inspector")).toBe("other");
    expect(classifyMcpClient("")).toBe("other");
    expect(classifyMcpClient(undefined)).toBe("other");
    expect(classifyMcpClient({ name: "claude" })).toBe("other");
  });
});

describe("extractMcpUsageEvents", () => {
  it("conta initialize por IA e tools/call por ferramenta", () => {
    const body = JSON.stringify([
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { clientInfo: { name: "claude-ai" } } },
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "buscar_produtos", arguments: {} } },
      { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "buscar_produtos" } },
      { jsonrpc: "2.0", id: 4, method: "tools/list" },
    ]);
    expect(extractMcpUsageEvents(body)).toEqual([
      { metric: "connection", key: "claude", count: 1 },
      { metric: "tool", key: "buscar_produtos", count: 2 },
    ]);
  });

  it("não conta chamada que falhou", () => {
    const body = JSON.stringify([
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "montar_orcamento" } },
      { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "obter_produto" } },
      { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "buscar_produtos" } },
    ]);
    const response = [
      { jsonrpc: "2.0", id: 1, result: { content: [], isError: true } },
      { jsonrpc: "2.0", id: 2, error: { code: -32602, message: "x" } },
      { jsonrpc: "2.0", id: 3, result: { content: [] } },
    ];
    expect(extractMcpUsageEvents(body, response)).toEqual([{ metric: "tool", key: "buscar_produtos", count: 1 }]);
  });

  it("ignora ferramenta desconhecida e JSON inválido", () => {
    expect(
      extractMcpUsageEvents(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "drop_table" } }))
    ).toEqual([]);
    expect(extractMcpUsageEvents("{nope")).toEqual([]);
    expect(extractMcpUsageEvents("null")).toEqual([]);
  });
});

describe("mergeEvents", () => {
  it("soma eventos com a mesma métrica e chave", () => {
    expect(
      mergeEvents([
        { metric: "connect_click", key: "home" },
        { metric: "connect_click", key: "home", count: 2 },
        { metric: "connect_click", key: "ia" },
      ])
    ).toEqual([
      { metric: "connect_click", key: "home", count: 3 },
      { metric: "connect_click", key: "ia", count: 1 },
    ]);
  });
});

describe("normalizeConnectSource / claudeConnectHref", () => {
  it("só aceita home; o resto é a página da IA", () => {
    expect(normalizeConnectSource("home")).toBe("home");
    expect(normalizeConnectSource("ia")).toBe("ia");
    expect(normalizeConnectSource("<script>")).toBe("ia");
    expect(normalizeConnectSource(null)).toBe("ia");
    expect(claudeConnectHref("home")).toBe("/api/ai/conectar-claude?de=home");
  });
});

describe("summarizeAiUsage", () => {
  it("preenche zeros e ignora chaves fora das listas", () => {
    const totals = summarizeAiUsage([
      { metric: "connection", key: "claude", total: 4 },
      { metric: "connection", key: "chatgpt", total: 1 },
      { metric: "connection", key: "hacker", total: 99 },
      { metric: "tool", key: "montar_orcamento", total: 2 },
      { metric: "connect_click", key: "home", total: 3 },
      { metric: "quote_link", key: "opened", total: 2 },
    ]);
    expect(totals.totalConnections).toBe(5);
    expect(totals.connections.perplexity).toBe(0);
    expect(totals.tools.montar_orcamento).toBe(2);
    expect(totals.totalToolCalls).toBe(2);
    expect(totals.connectClicks).toEqual({ home: 3, ia: 0 });
    expect(totals.quoteLinksOpened).toBe(2);
  });
});
