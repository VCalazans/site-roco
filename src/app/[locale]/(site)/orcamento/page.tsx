import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CartPageView } from "@/modules/cart/components/cart-page-view";
import { quotePath } from "@/core/config/site";
import { resolveLeadUtm } from "@/server/lib/lead-utm";
import { locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

type PageProps = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
  }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;

  if (!locales.includes(locale)) {
    notFound();
  }

  const dictionary = await getDictionary(locale);
  const { cart } = dictionary;
  return {
    title: cart.seo.title,
    description: cart.seo.description,
    alternates: { canonical: quotePath(locale) },
  };
}

/**
 * "Meu orçamento" (`/{locale}/orcamento`; era `/carrinho` — redirect 308 em
 * `next.config.ts`). NÃO é e-commerce (sem preço, sem checkout): junta vários
 * produtos numa solicitação só, reaproveitando `POST /api/contact` (`subject:
 * "cart"`, identificador técnico mantido) e os mesmos canais de saída dos
 * outros formulários públicos (RD Station, e-mail, `contact_submissions`).
 *
 * A lista vive só no CLIENT (`localStorage`, ver `@/shared/lib/cart-store`) —
 * este Server Component resolve o que SEMPRE vem do servidor: dicionário e a
 * campanha externa (UTM). A origem do lead não é lida aqui: a rota grava
 * `"orcamento"` sozinha para este assunto. O header vive no layout `(site)`.
 */
export default async function QuotePage({ params, searchParams }: PageProps) {
  const { locale } = await params;

  if (!locales.includes(locale)) {
    notFound();
  }

  const query = await searchParams;
  const dictionary = await getDictionary(locale);
  const { cart } = dictionary;

  // Campanha externa: da querystring desta página OU do cookie de primeira
  // parte gravado no pouso (`resolveLeadUtm`) — quem clica um anúncio quase
  // nunca cai direto na página do orçamento.
  const utm = await resolveLeadUtm(query);

  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-[#05070b]">
      {/* Fundo dual-tone da marca: mesma linguagem visual de /contato,
          /catalogo e /representantes. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-1/4 size-[34rem] rounded-full bg-neon-cyan/15 blur-[140px]" />
        <div className="absolute -right-40 bottom-0 size-[30rem] rounded-full bg-neon-amber/10 blur-[140px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-5 pb-16 pt-24 sm:px-6 md:pt-32">
        <CartPageView content={cart} locale={locale} utm={utm} />
      </div>
    </div>
  );
}
