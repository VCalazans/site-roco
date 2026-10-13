import "server-only";
import type { Metadata } from "next";
import { absoluteUrl, buildAlternates } from "@/core/config/metadata";
import { contactPath } from "@/core/config/site";
import type { Locale } from "@/i18n/config";
import { buildBreadcrumbList } from "@/modules/ai/lib/json-ld";
import { getSiteFacts } from "@/modules/ai/server/site-facts";
import { LegalPage } from "@/modules/legal/components/legal-page";
import { fillLegalDocument, fillLegalText, type LegalValues } from "@/modules/legal/lib/legal-content";
import { JsonLd } from "@/shared/components/seo/json-ld";

export type LegalKind = "privacy" | "terms" | "cookies";

/**
 * Dados reais que entram nos marcadores dos textos legais. Sem e-mail no
 * rodapé, o contato vira o endereço da página de contato (nunca um e-mail
 * inventado nem o marcador cru).
 */
async function legalContext(locale: Locale) {
  const facts = await getSiteFacts(locale);
  const values: LegalValues = {
    company: facts.dictionary.ai.organization.legalName,
    address: facts.contact.addressHeadquarters || facts.dictionary.legal.common.addressFallback,
    email: facts.contact.email || absoluteUrl(contactPath(locale)),
    siteUrl: absoluteUrl("/"),
  };
  return { facts, values };
}

export async function legalMetadata(locale: Locale, kind: LegalKind, segment: string): Promise<Metadata> {
  const { facts, values } = await legalContext(locale);
  const document = fillLegalDocument(facts.dictionary.legal[kind], values);
  return {
    title: document.seo.title,
    description: document.seo.description,
    alternates: buildAlternates(locale, `/${segment}`),
  };
}

export async function LegalRoute({ locale, kind, segment }: { locale: Locale; kind: LegalKind; segment: string }) {
  const { facts, values } = await legalContext(locale);
  const { legal, products } = facts.dictionary;
  const document = fillLegalDocument(legal[kind], values);

  return (
    <>
      <JsonLd
        data={buildBreadcrumbList([
          { name: products.detail.breadcrumbHome, path: `/${locale}` },
          { name: document.title, path: `/${locale}/${segment}` },
        ])}
      />
      <LegalPage
        document={document}
        common={{ ...legal.common, contactBody: fillLegalText(legal.common.contactBody, values) }}
      />
    </>
  );
}
