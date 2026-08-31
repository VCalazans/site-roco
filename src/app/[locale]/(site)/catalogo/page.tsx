import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { CatalogForm } from "@/modules/catalog/components/catalog-form";
import { resolveCatalogOrigin } from "@/modules/catalog/lib/catalog-form";
import { getCatalogDictionary } from "@/modules/catalog/lib/types";
import { catalogPath, siteLinks } from "@/core/config/site";
import { getCatalogPdfUrl } from "@/server/lib/site-settings";
import { resolveLeadUtm } from "@/server/lib/lead-utm";
import { locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { SiteHeader } from "@/shared/components/nav";
import { siteNavLinks } from "@/shared/lib/nav";

/**
 * Landing do catálogo: o PDF fica ATRÁS de um formulário de captura.
 *
 * O gate é o comportamento original da página — a saída do Mautic
 * (2026-08-23) transformou-a num download direto e, com isso, no único
 * material de valor do site que não gerava lead nenhum. O formulário
 * reaproveita `POST /api/contact` com `subject: "catalog"` (ver
 * `catalog-form.tsx`); o PDF servido em `/downloads/…` para o portal interno
 * não é afetado — quem já está logado não passa por captura.
 *
 * O gate é de MARKETING, não de acesso: a URL do PDF desce como prop do
 * formulário (o painel de sucesso precisa dela) e o arquivo padrão mora em
 * `public/`, então quem abrir o código-fonte a encontra. Isso não é uma
 * regressão nem um vazamento novo — o arquivo sempre foi público e o portal
 * interno o linka direto. Se algum dia o catálogo precisar de acesso
 * controlado, o caminho é servi-lo por rota autenticada (ou por presigned URL
 * do R2, como os materiais de representante), nunca esconder o link daqui.
 *
 * Escrita em Tailwind, não MUI: esta rota vive no route group `(site)`, que
 * por arquitetura é Tailwind-only — MUI é do `(internal)` (ver
 * systemPatterns, "MUI + Tailwind: Coexistência"). A versão anterior usava
 * componentes MUI aqui e quebrava a página inteira com HTTP 500:
 *
 *   Error: Functions cannot be passed directly to Client Components
 *   {component: function i, href, download, ...}
 *
 * O `<Button component={Link}>` do MUI passa um COMPONENTE (função) como prop
 * de um Server Component para um Client Component, o que o React Server
 * Components proíbe.
 */

type PageProps = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{
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
  const catalog = getCatalogDictionary(dictionary);
  return {
    title: catalog.seo.title,
    description: catalog.seo.description,
    // Cada CTA chega com um `?origem=` diferente, e cada querystring é uma
    // URL distinta para o crawler. O canônico aponta sempre para a página
    // limpa (a mesma que está no sitemap) — mesma regra de `/contato`.
    alternates: { canonical: catalogPath(locale) },
  };
}

export default async function CatalogPage({ params, searchParams }: PageProps) {
  const { locale } = await params;

  if (!locales.includes(locale)) {
    notFound();
  }

  const query = await searchParams;
  const { origem } = query;

  const dictionary = await getDictionary(locale);
  const catalog = getCatalogDictionary(dictionary);
  const { navigation, cart } = dictionary;

  const navLinks = siteNavLinks(navigation.links, locale);
  const pdfUrl = await getCatalogPdfUrl();

  // Rastreio de aquisição validado AQUI, no servidor: origem fora da lista
  // fechada cai no fallback `"catalogo"` e UTM malformada é descartada — a
  // rota `POST /api/contact` revalida os dois de novo, por princípio.
  // A campanha vem da querystring desta página OU do cookie de primeira parte
  // gravado no pouso (`resolveLeadUtm`).
  const origin = resolveCatalogOrigin(origem);
  const utm = await resolveLeadUtm(query);

  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-[#05070b]">
      {/* Fundo dual-tone da marca: glow ciano à esquerda, âmbar à direita —
          mesma linguagem visual de /contato e /representantes. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-1/4 size-[34rem] rounded-full bg-neon-cyan/15 blur-[140px]" />
        <div className="absolute -right-40 bottom-0 size-[30rem] rounded-full bg-neon-amber/10 blur-[140px]" />
      </div>

      <SiteHeader
        brand={navigation.brand}
        links={navLinks}
        menuLabels={{ open: navigation.menu, close: navigation.close }}
        locale={locale}
        controls={{ language: navigation.language, portalLogin: navigation.portalLogin, cart: cart.nav.label }}
      />

      <main className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 items-start gap-8 px-5 pb-12 pt-24 sm:px-6 md:pt-32 lg:grid-cols-[minmax(0,1fr)_minmax(21rem,29rem)] lg:gap-14">
        <div className="max-w-xl lg:sticky lg:top-32">
          <p className="text-glow-amber text-meta font-semibold uppercase tracking-[0.2em] text-neon-amber-bright">
            {navigation.brand}
          </p>
          <h1 className="text-glow-soft mt-3 font-display text-h1 text-white">
            {catalog.headline}
          </h1>
          <p className="mt-4 text-body text-white/80">{catalog.description}</p>

          <div className="relative mt-8 hidden h-56 w-56 overflow-hidden rounded-full shadow-[0_0_60px_-10px_rgba(53,217,255,0.35)] lg:block">
            <Image
              src="/images/hero/hero-stage.jpg"
              alt={catalog.sceneAlt}
              fill
              sizes="224px"
              className="object-cover"
            />
          </div>
        </div>

        <CatalogForm
          content={catalog}
          locale={locale}
          pdfUrl={pdfUrl}
          origin={origin}
          utm={utm}
          privacyHref={siteLinks.privacy || undefined}
        />
      </main>
    </div>
  );
}
