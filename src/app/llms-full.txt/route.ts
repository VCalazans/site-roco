import { buildLlmsFullTxt } from "@/modules/ai/lib/llms";
import { getLlmsInput, getLlmsProducts } from "@/modules/ai/server/llms-input";

/**
 * `/llms-full.txt` (spec 003) — tudo do `/llms.txt` + uma linha por produto
 * publicado (~740). Catálogo pela tag `products` (cache de 300 s) e resposta
 * com cache de 1 h na borda.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const [input, products] = await Promise.all([getLlmsInput("pt"), getLlmsProducts("pt").catch(() => [])]);
  return new Response(buildLlmsFullTxt(input, products), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
