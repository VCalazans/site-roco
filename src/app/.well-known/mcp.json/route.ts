import { NextResponse } from "next/server";
import { buildRocoServerCard } from "@/modules/ai/server/mcp-server";

/** Cartão do servidor MCP público (descoberta; ver `buildRocoServerCard`). */
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await buildRocoServerCard(), {
    headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" },
  });
}
