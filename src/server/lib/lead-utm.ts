/**
 * Resolução da campanha externa (UTM) para as duas páginas de captura de lead
 * (`/{locale}/contato`, `/{locale}/catalogo`).
 *
 * Duas fontes, nesta ordem:
 *  1. a querystring da própria página (anúncio que aponta direto para o
 *     formulário — raro, mas é a informação mais fresca);
 *  2. o cookie de primeira parte gravado pelo `proxy.ts` na URL de ENTRADA
 *     (o caso comum: a pessoa pousa na home ou num produto e só depois chega
 *     ao formulário, e nenhum link interno propaga querystring).
 *
 * Sem o passo (2) a atribuição de campanha ficaria sistematicamente vazia no
 * RD Station — ver `UTM_COOKIE` em `@/shared/lib/lead-origin`.
 *
 * `server-only` porque lê `cookies()`; a lógica pura de saneamento vive no
 * módulo compartilhado e é testada lá.
 */
import "server-only";
import { cookies } from "next/headers";
import { normalizeUtmValue, readUtmCookie, UTM_COOKIE } from "@/shared/lib/lead-origin";

/** Campanha já saneada, no formato que os formulários consomem. */
export type LeadUtm = { source?: string; medium?: string; campaign?: string };

export type LeadUtmSearchParams = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
};

export async function resolveLeadUtm(params: LeadUtmSearchParams): Promise<LeadUtm> {
  const stored = readUtmCookie((await cookies()).get(UTM_COOKIE)?.value);

  return {
    source: normalizeUtmValue(params.utm_source) ?? stored.utm_source,
    medium: normalizeUtmValue(params.utm_medium) ?? stored.utm_medium,
    campaign: normalizeUtmValue(params.utm_campaign) ?? stored.utm_campaign,
  };
}
