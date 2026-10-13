import "server-only";
import { absoluteUrl } from "@/core/config/metadata";
import { getDictionary } from "@/i18n/get-dictionary";
import { definitionOf, LATEST_PROTOCOL_VERSION, SUPPORTED_PROTOCOL_VERSIONS, type McpServer } from "@/modules/ai/lib/mcp-protocol";
import { buildMcpTools, MCP_TOOL_NAMES } from "@/modules/ai/lib/mcp-tools";
import { catalogSource } from "@/modules/ai/server/catalog-source";

/** Versão do servidor MCP (sobe quando ferramentas mudam de contrato). */
export const MCP_SERVER_VERSION = "1.0.0";
export const MCP_SERVER_NAME = "roco-catalogo";
export const MCP_PATH = "/mcp";

/** Textos do servidor no idioma principal do site (pt). */
export async function getRocoMcpServer(): Promise<McpServer> {
  const { ai } = await getDictionary("pt");
  return {
    info: {
      name: MCP_SERVER_NAME,
      title: "ROCO — catálogo oficial",
      version: MCP_SERVER_VERSION,
      websiteUrl: absoluteUrl("/"),
    },
    instructions: ai.mcp.instructions,
    tools: () => buildMcpTools(catalogSource),
  };
}

/** Descrição legível (GET sem SSE, cartão `.well-known`, llms.txt). */
export async function describeRocoMcpServer() {
  const { ai } = await getDictionary("pt");
  return {
    name: MCP_SERVER_NAME,
    title: "ROCO — catálogo oficial",
    version: MCP_SERVER_VERSION,
    description: ai.mcp.description,
    endpoint: absoluteUrl(MCP_PATH),
    transport: "streamable-http",
    authentication: "none",
    readOnly: true,
    tools: [...MCP_TOOL_NAMES],
    documentation: absoluteUrl("/llms.txt"),
  };
}

/**
 * Cartão do servidor para descoberta antes da conexão (`/.well-known/mcp.json`
 * e `/.well-known/mcp/server-card.json`). O formato de "server card" ainda é
 * rascunho no MCP (SEP-1649 → SEP-2127) — por isso os dois caminhos, e campos
 * no estilo do `server.json` do registro oficial (`remotes`).
 */
export async function buildRocoServerCard() {
  const description = await describeRocoMcpServer();
  const tools = await buildMcpTools(catalogSource)
    .then((list) => list.map(definitionOf))
    .catch(() => MCP_TOOL_NAMES.map((name) => ({ name })));

  return {
    name: `br.com.roco/${MCP_SERVER_NAME}`,
    title: description.title,
    description: description.description,
    version: MCP_SERVER_VERSION,
    websiteUrl: absoluteUrl("/"),
    documentationUrl: description.documentation,
    protocolVersion: LATEST_PROTOCOL_VERSION,
    supportedProtocolVersions: [...SUPPORTED_PROTOCOL_VERSIONS],
    remotes: [{ type: "streamable-http", url: description.endpoint }],
    authentication: { required: false },
    capabilities: { tools: { listChanged: false } },
    readOnly: true,
    tools,
  };
}
