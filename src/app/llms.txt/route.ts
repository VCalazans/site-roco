import { buildLlmsTxt } from "@/modules/ai/lib/llms";
import { getLlmsInput } from "@/modules/ai/server/llms-input";

/**
 * `/llms.txt` (spec 003) — resumo da ROCO para assistentes de IA, em
 * português (idioma principal). Gerado da MESMA fonte das páginas
 * (dicionário, rodapé, catálogo): nenhum texto paralelo mantido à mão.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const text = buildLlmsTxt(await getLlmsInput("pt"));
  return new Response(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
