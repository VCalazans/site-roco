import { after, NextResponse, type NextRequest } from "next/server";
import { absoluteUrl } from "@/core/config/metadata";
import { getDictionary } from "@/i18n/get-dictionary";
import { normalizeConnectSource } from "@/modules/ai/lib/ai-usage";
import { claudeConnectorInstallUrl } from "@/modules/ai/lib/ask-ai";
import { MCP_PATH } from "@/modules/ai/server/mcp-server";
import { recordAiUsage } from "@/server/lib/ai-usage";
import { checkRateLimit, getClientIp } from "@/server/lib/rate-limit";

/**
 * Botão "Conectar ao Claude" (home e `/ia`): conta o clique e redireciona para
 * o link OFICIAL do Claude que abre "Adicionar conector personalizado" já
 * preenchido. O clique é contado no máximo 3 vezes a cada 10 min por IP
 * (fail-open: sem Redis conta tudo); o redirect sai sempre. Nada é gravado além
 * do contador diário (`ai_usage_daily`, métrica `connect_click`).
 */
export const dynamic = "force-dynamic";

const CLICK_IP_RATE_LIMIT = { windowSeconds: 10 * 60, max: 3 };

export async function GET(request: NextRequest) {
  const source = normalizeConnectSource(request.nextUrl.searchParams.get("de"));
  const ip = getClientIp(request);
  after(async () => {
    const limit = await checkRateLimit(`ai-connect-click:ip:${ip}`, CLICK_IP_RATE_LIMIT);
    if (limit.allowed) await recordAiUsage([{ metric: "connect_click", key: source }]);
  });

  const dictionary = await getDictionary("pt");
  const target = claudeConnectorInstallUrl(dictionary.navigation.brand, absoluteUrl(MCP_PATH));
  return NextResponse.redirect(target, {
    status: 302,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}
