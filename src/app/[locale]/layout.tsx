import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { MauticTracking } from "@/shared/components/analytics";
import { ContactFormProvider } from "@/shared/components/contact-form";
import { WhatsAppFloat } from "@/shared/components/whatsapp-float";
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
      <WhatsAppFloat content={dictionary.whatsapp} />
      {/* Tracking de visitantes (Mautic). Vive aqui, e não no layout raiz, para
          cobrir todas as rotas localizadas — que são todas as páginas reais do
          site — mantendo o layout raiz livre de client components. */}
      <MauticTracking />
    </ContactFormProvider>
  );
}
