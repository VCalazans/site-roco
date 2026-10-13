import { NextResponse } from "next/server";
import { buildRocoServerCard } from "@/modules/ai/server/mcp-server";

/** Mesmo cartão de `/.well-known/mcp.json`, no caminho do rascunho SEP-2127 do MCP. */
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await buildRocoServerCard(), {
    headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" },
  });
}
