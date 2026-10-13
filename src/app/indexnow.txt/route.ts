import { getIndexNowKey } from "@/server/lib/indexnow";

/** Arquivo de chave do IndexNow (prova de posse do domínio). 404 sem `INDEXNOW_KEY`. */
export const dynamic = "force-dynamic";

export function GET() {
  const key = getIndexNowKey();
  if (!key) return new Response("Not found", { status: 404 });
  return new Response(key, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
