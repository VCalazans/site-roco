import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { TERMS_SEGMENT } from "@/core/config/site";
import { locales, type Locale } from "@/i18n/config";
import { LegalRoute, legalMetadata } from "@/modules/legal/server/legal-route";

type PageProps = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!locales.includes(locale)) notFound();
  return legalMetadata(locale, "terms", TERMS_SEGMENT);
}

/** Página legal (texto em `legal.terms` dos dicionários; contato e endereço do rodapé). */
export default async function Page({ params }: PageProps) {
  const { locale } = await params;
  if (!locales.includes(locale)) notFound();
  await connection();
  return <LegalRoute locale={locale} kind="terms" segment={TERMS_SEGMENT} />;
}
