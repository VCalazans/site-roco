import "server-only";
import { after } from "next/server";
import { absoluteUrl, siteUrl } from "@/core/config/metadata";
import { PRODUCTS_SEGMENT } from "@/core/config/site";
import { locales } from "@/i18n/config";

/**
 * IndexNow (Bing, Yandex, Seznam, Naver…) — spec 003. Avisa os buscadores na
 * hora em que uma página muda, em vez de esperar o próximo rastreio.
 *
 * Desligado sem `INDEXNOW_KEY`. A chave é PÚBLICA por desenho (fica em
 * `/indexnow.txt`, que prova a posse do domínio). O envio sai em `after()`,
 * depois da resposta: falha ou lentidão do serviço nunca afeta o portal.
 */
const ENDPOINT = "https://api.indexnow.org/indexnow";
const KEY_PATTERN = /^[A-Za-z0-9-]{8,128}$/;
/** Caminho da chave — rota estática `src/app/indexnow.txt/route.ts`. */
export const INDEXNOW_KEY_PATH = "/indexnow.txt";
const MAX_URLS = 10_000;
const TIMEOUT_MS = 5_000;

export function getIndexNowKey(): string | null {
  const key = process.env.INDEXNOW_KEY?.trim() ?? "";
  return KEY_PATTERN.test(key) ? key : null;
}

/** Corpo do POST (puro). URLs de outro host são descartadas — o IndexNow recusaria o lote. */
export function buildIndexNowPayload(urls: string[], key: string) {
  const host = new URL(siteUrl).host;
  const urlList = [...new Set(urls)].filter((url) => {
    try {
      return new URL(url).host === host;
    } catch {
      return false;
    }
  });
  return {
    host,
    key,
    keyLocation: absoluteUrl(INDEXNOW_KEY_PATH),
    urlList: urlList.slice(0, MAX_URLS),
  };
}

/** URLs públicas de um produto nos dois idiomas. */
export function productUrls(slug: string): string[] {
  return locales.map((locale) => absoluteUrl(`/${locale}/${PRODUCTS_SEGMENT}/${encodeURIComponent(slug)}`));
}

/** Agenda o aviso (depois da resposta). Nunca lança. */
export function submitToIndexNow(urls: string[]): void {
  const key = getIndexNowKey();
  if (!key || urls.length === 0) return;
  const payload = buildIndexNowPayload(urls, key);
  if (payload.urlList.length === 0) return;

  const send = async () => {
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok && response.status !== 202) {
        console.warn(`[indexnow] recusado: HTTP ${response.status}`);
      }
    } catch (error) {
      console.warn("[indexnow] falha no envio:", error instanceof Error ? error.name : "unknown");
    }
  };

  try {
    after(send);
  } catch {
    // Fora de um contexto de requisição (script/teste): envia sem esperar.
    void send();
  }
}
