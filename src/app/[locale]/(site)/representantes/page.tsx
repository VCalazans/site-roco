import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RegisterForm } from "@/modules/representatives/components/register-form";
import { getRepresentativesDictionary } from "@/modules/representatives/lib/types";
import { locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { SiteHeader } from "@/shared/components/nav";
import { siteNavLinks } from "@/shared/lib/nav";

type PageProps = {
  params: Promise<{ locale: Locale }>;
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
  const representatives = getRepresentativesDictionary(dictionary);
  return {
    title: representatives.seo.title,
    description: representatives.seo.description,
  };
}

/**
 * Canal público de aquisição de representantes: pré-cadastro com CNPJ
 * obrigatório que cai direto na fila de aprovação do time interno
 * (`/portal/representantes`). Após aprovado, o representante entra no portal
 * (e-mail + senha definidos aqui, ou Google SSO com o mesmo e-mail) e completa
 * o restante do cadastro no primeiro acesso.
 */
export default async function RepresentativesPage({ params }: PageProps) {
  const { locale } = await params;

  if (!locales.includes(locale)) {
    notFound();
  }

  const dictionary = await getDictionary(locale);
  const representatives = getRepresentativesDictionary(dictionary);
  const { navigation, cart } = dictionary;

  const navLinks = siteNavLinks(navigation.links, locale);

  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-[#05070b]">
      {/* Fundo dual-tone da marca: glow ciano à esquerda, âmbar à direita —
          mesma linguagem do render da landing, sem depender de arte nova. */}
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
          <h1 className="text-glow-soft font-display text-h1 text-white">
            {representatives.headline}
          </h1>
          <p className="mt-3 text-lede text-neon-cyan-bright">
            {representatives.subheadline}
          </p>
          <p className="mt-4 text-body text-white/80">{representatives.intro}</p>
        </div>

        <RegisterForm
          content={representatives}
          loginHref={`/${locale}/portal/login`}
        />
      </main>
    </div>
  );
}
