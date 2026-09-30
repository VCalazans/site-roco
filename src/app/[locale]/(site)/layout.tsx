import { ViewTransition, type ReactNode } from "react";
import { RdStationTracking } from "@/shared/components/analytics";
import { BackToTop } from "@/shared/components/back-to-top/back-to-top";
import { ConsentBanner } from "@/shared/components/consent/consent-banner";
import { SiteFooter } from "@/shared/components/footer";
import { SiteHeader } from "@/shared/components/nav";
import { defaultLocale, locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { siteNavLinks } from "@/shared/lib/nav";

type SiteLayoutProps = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

/**
 * Layout do SITE PÚBLICO (home + catálogo de produtos + orçamento + contato +
 * representantes). O grupo `(site)` existe para que o header, o rodapé e o
 * tracking de marketing não vazem para o portal interno
 * — `(internal)` tem providers próprios (MUI) e nenhum script de marketing.
 *
 * HEADER NO LAYOUT (spec 001, RF15). Até aqui cada `page.tsx` montava o seu
 * `SiteHeader`, então toda navegação desmontava e remontava a barra (estado
 * de rolagem, busca aberta, contagem do orçamento piscando). No layout ela
 * persiste entre páginas; o conteúdo troca por baixo dela dentro de um
 * `<ViewTransition>` (crossfade curto do React canary empacotado pelo Next 16
 * — sem suporte no navegador, a troca é instantânea como antes).
 */
export default async function SiteLayout({ children, params }: SiteLayoutProps) {
  const { locale: rawLocale } = await params;
  const locale: Locale = locales.includes(rawLocale as Locale) ? (rawLocale as Locale) : defaultLocale;
  const dictionary = await getDictionary(locale);
  const { navigation, cart } = dictionary;

  return (
    <>
      {/* Pular para o conteúdo: primeiro foco da página (WCAG 2.4.1). */}
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-neon-cyan-bright focus:px-5 focus:py-3 focus:text-ui focus:text-background"
      >
        {navigation.skipToContent}
      </a>

      <SiteHeader
        brand={navigation.brand}
        links={siteNavLinks(navigation.links, locale)}
        menuLabels={{ open: navigation.menu, close: navigation.close }}
        locale={locale}
        controls={{
          language: navigation.language,
          portalLogin: navigation.portalLogin,
          cart: cart.nav.label,
          search: navigation.search,
        }}
      />

      <main id="conteudo" tabIndex={-1} className="outline-none">
        <ViewTransition>{children}</ViewTransition>
      </main>

      <SiteFooter content={dictionary.footer} brand={navigation.brand} locale={locale} />
      <BackToTop label={navigation.backToTop} />
      {/* Tracking de visitantes (RD Station). Vive aqui, e não no layout de
       * [locale], para cobrir todas as rotas públicas sem instrumentar o
       * portal interno. O loader também renderiza os POP-UPS do RD, inclusive
       * o botão flutuante do WhatsApp — por isso o site não tem botão próprio
       * (removido na main em 2026-09-21). Nos builds locais a flag
       * NEXT_PUBLIC_RDSTATION_TRACKING_ENABLED vem "false": sem RD, sem pop-up. */}
      <RdStationTracking />
      {/* Banner LGPD. Liga via NEXT_PUBLIC_CONSENT_ENABLED=true; o jurídico
       * precisa preencher a `body` final do dicionário antes de ligar em
       * produção. Renderiza `null` quando desligado — zero overhead. */}
      {dictionary.site?.consent ? <ConsentBanner copy={dictionary.site.consent} /> : null}
    </>
  );
}
