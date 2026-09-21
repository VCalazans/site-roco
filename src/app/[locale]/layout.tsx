import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { RdStationTracking } from "@/shared/components/analytics";
import { ContactFormProvider } from "@/shared/components/contact-form";
import { locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

type LocaleLayoutProps = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;

  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  const dictionary = await getDictionary(locale as Locale);

  return (
    <ContactFormProvider content={dictionary.contact}>
      {children}
      {/* Tracking de visitantes (RD Station — substituiu o Mautic em
          2026-08-30). Vive aqui, e não no layout raiz, para cobrir todas as
          rotas localizadas — que são todas as páginas reais do site.
          O formulário de contato continua no Mautic; só o TRACKING migrou.
          O loader também renderiza os POP-UPS do RD, inclusive o botão
          flutuante do WhatsApp — por isso o site não tem botão próprio. */}
      <RdStationTracking />
    </ContactFormProvider>
  );
}
