import type { ReactNode } from "react";
import { notFound } from "next/navigation";
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
    </ContactFormProvider>
  );
}
