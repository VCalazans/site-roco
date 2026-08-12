import type { ReactNode } from "react";
import { MauticTracking } from "@/shared/components/analytics";
import { ContactFormProvider } from "@/shared/components/contact-form";
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
    <ContactFormProvider content={dictionary.contact}>
      {children}
      <SiteFooter content={dictionary.footer} brand={dictionary.navigation.brand} locale={locale as Locale} />
      <WhatsAppFloat content={dictionary.whatsapp} />
      {/* Tracking de visitantes (Mautic). Vive aqui, e não no layout de [locale],
          para cobrir todas as rotas públicas sem instrumentar o portal interno. */}
      <MauticTracking />
    </ContactFormProvider>
  );
}
