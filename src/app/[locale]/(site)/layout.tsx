import type { ReactNode } from "react";
import { RdStationTracking } from "@/shared/components/analytics";
import { ConsentBanner } from "@/shared/components/consent/consent-banner";
import { SiteFooter } from "@/shared/components/footer";
import { WhatsAppFloat } from "@/shared/components/whatsapp-float";
import { type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

type SiteLayoutProps = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

/**
 * Layout do SITE PÚBLICO (home + catálogo de produtos + representantes). O
 * grupo `(site)` existe para que o botão flutuante de WhatsApp, o rodapé e o
 * tracking de marketing (Mautic) não vazem para o portal interno —
 * `(internal)` tem providers próprios (MUI) e nenhum script de marketing.
 */
export default async function SiteLayout({ children, params }: SiteLayoutProps) {
  const { locale } = await params;
  const dictionary = await getDictionary(locale as Locale);

  return (
    <>
      {children}
      <SiteFooter content={dictionary.footer} brand={dictionary.navigation.brand} locale={locale as Locale} />
      <WhatsAppFloat content={dictionary.whatsapp} />
      {/* Tracking de visitantes (RD Station). Vive aqui, e não no layout de
       * [locale], para cobrir todas as rotas públicas sem instrumentar o
       * portal interno. Desligado por padrão — só ativa quando
       * NEXT_PUBLIC_RDSTATION_TRACKING_ENABLED=true. */}
      <RdStationTracking />
      {/* Banner LGPD. Liga via NEXT_PUBLIC_CONSENT_ENABLED=true; o jurídico
       * precisa preencher a `body` final do dicionário antes de ligar em
       * produção. Renderiza `null` quando desligado — zero overhead. */}
      {dictionary.site?.consent ? <ConsentBanner copy={dictionary.site.consent} /> : null}
    </>
  );
}
