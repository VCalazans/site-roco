import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContactForm } from "@/modules/contact/components/contact-form";
import { getContactDictionary } from "@/modules/contact/lib/types";
import { contactPath } from "@/core/config/site";
import { SELECTABLE_CONTACT_SUBJECTS } from "@/server/lib/contact-submit";
import { getPublicProductBySlug } from "@/server/lib/public-products";
import { resolveLeadUtm } from "@/server/lib/lead-utm";
import { locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { SiteHeader } from "@/shared/components/nav";
import { normalizeLeadOrigin } from "@/shared/lib/lead-origin";
import { siteNavLinks } from "@/shared/lib/nav";

type PageProps = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{
    produto?: string;
    assunto?: string;
    /** Seção do site que originou o clique — ver `@/shared/lib/lead-origin`. */
    origem?: string;
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
  const contact = getContactDictionary(dictionary);
  return {
    title: contact.seo.title,
    description: contact.seo.description,
    // Cada CTA chega com um `?origem=` diferente, e cada querystring é uma
    // URL distinta para o crawler. O canônico aponta sempre para a página
    // limpa (a mesma que está no sitemap).
    alternates: { canonical: contactPath(locale) },
  };
}

/**
 * Só os assuntos que existem no dropdown: `?assunto=catalog` (usado pela
 * página de catálogo, que reaproveita a mesma rota de API) não pode
 * pré-selecionar uma opção que este formulário não renderiza.
 */
function resolveDefaultSubject(assunto: string | undefined) {
  return (SELECTABLE_CONTACT_SUBJECTS as readonly string[]).includes(assunto ?? "")
    ? (assunto as (typeof SELECTABLE_CONTACT_SUBJECTS)[number])
    : undefined;
}

/**
 * Página pública de contato — destino do clique de maior intenção comercial
 * do site: "Solicite um orçamento" no detalhe do produto (`?produto=slug&
 * assunto=quote`), o item "Contato" da nav e os links do rodapé (via
 * `resolveDestination("#contato", locale, origem)`).
 *
 * Tudo que chega pela URL é resolvido/validado AQUI, no servidor, e desce
 * como prop somente-leitura para o form — o cliente nunca é a autoridade:
 *  - `produto` vira nome/SKU reais do catálogo (nunca um nome cru do body);
 *  - `origem` é conferida contra a lista fechada de seções do site;
 *  - `utm_*` são saneadas (trim, teto, sem caractere de controle).
 * A rota `POST /api/contact` revalida os três de novo, por princípio.
 */
export default async function ContactPage({ params, searchParams }: PageProps) {
  const { locale } = await params;

  if (!locales.includes(locale)) {
    notFound();
  }

  const query = await searchParams;
  const { produto, assunto, origem } = query;

  const dictionary = await getDictionary(locale);
  const contact = getContactDictionary(dictionary);
  const { navigation } = dictionary;

  const navLinks = siteNavLinks(navigation.links, locale);

  let productContext: { slug: string; name: string; sku: string } | null = null;
  if (produto) {
    try {
      const product = await getPublicProductBySlug(produto);
      if (product) {
        productContext = {
          slug: produto,
          name: locale === "en" && product.nameEn ? product.nameEn : product.namePt,
          sku: product.sku,
        };
      }
    } catch (error) {
      console.error("[contato] Falha ao resolver produto do contexto — ignorando.", error);
    }
  }

  const defaultSubject = resolveDefaultSubject(assunto);

  // Rastreio de aquisição validado AQUI, no servidor: origem fora da lista
  // fechada e UTM malformada são descartadas antes de chegar ao formulário
  // (o servidor valida de novo na rota — o cliente nunca é a autoridade).
  // A campanha vem da querystring desta página OU do cookie de primeira parte
  // gravado no pouso (`resolveLeadUtm`) — quem clica um anúncio quase nunca
  // cai direto no formulário.
  const origin = normalizeLeadOrigin(origem);
  const utm = await resolveLeadUtm(query);

  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-[#05070b]">
      {/* Fundo dual-tone da marca: glow ciano à esquerda, âmbar à direita —
          mesma linguagem visual usada em /representantes. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-1/4 size-[34rem] rounded-full bg-neon-cyan/15 blur-[140px]" />
        <div className="absolute -right-40 bottom-0 size-[30rem] rounded-full bg-neon-amber/10 blur-[140px]" />
      </div>

      <SiteHeader
        brand={navigation.brand}
        links={navLinks}
        menuLabels={{ open: navigation.menu, close: navigation.close }}
        locale={locale}
        controls={{ language: navigation.language, portalLogin: navigation.portalLogin }}
      />

      <main className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 items-start gap-8 px-5 pb-12 pt-24 sm:px-6 md:pt-32 lg:grid-cols-[minmax(0,1fr)_minmax(21rem,29rem)] lg:gap-14">
        <div className="max-w-xl lg:sticky lg:top-32">
          <h1 className="text-glow-soft font-display text-h1 text-white">{contact.headline}</h1>
          <p className="mt-3 text-lede text-neon-cyan-bright">{contact.subheadline}</p>
          <p className="mt-4 text-body text-white/80">{contact.intro}</p>
        </div>

        <ContactForm
          content={contact}
          locale={locale}
          productContext={productContext}
          defaultSubject={defaultSubject}
          origin={origin}
          utm={utm}
        />
      </main>
    </div>
  );
}
