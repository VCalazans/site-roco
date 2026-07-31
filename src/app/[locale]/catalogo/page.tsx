import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CATALOG_FORM_ANCHOR,
  CatalogHero,
} from "@/modules/catalog/components/catalog-hero";
import {
  CATALOG_PDF_FILENAME,
  resolveDestination,
  siteLinks,
} from "@/core/config/site";
import { locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { visibleNavLinks } from "@/shared/lib/nav";

type PageProps = {
  params: Promise<{ locale: Locale }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;

  if (!locales.includes(locale)) {
    notFound();
  }

  const dictionary = await getDictionary(locale);
  return {
    title: dictionary.catalog.seo.title,
    description: dictionary.catalog.seo.description,
  };
}

export default async function CatalogPage({ params }: PageProps) {
  const { locale } = await params;

  if (!locales.includes(locale)) {
    notFound();
  }

  const dictionary = await getDictionary(locale);
  const { catalog, contact, navigation } = dictionary;

  /**
   * This page already embeds the shared Mautic form inline, and only one embed
   * of it may exist per page (duplicate `mauticform_<alias>` ids would confuse
   * the SDK). So the nav's contact links scroll to that form instead of opening
   * the contact modal — which also reads better here.
   */
  const navLinks = visibleNavLinks(navigation.links).map((link) => ({
    ...link,
    href:
      link.href === "#contato"
        ? `#${CATALOG_FORM_ANCHOR}`
        : resolveDestination(link.href, locale),
  }));

  const content = {
    brand: navigation.brand,
    headline: catalog.headline,
    description: catalog.description,
    sceneAlt: catalog.sceneAlt,
    form: {
      title: catalog.formTitle,
      privacyNotice: catalog.privacyNotice,
      privacyLabel: catalog.privacyLabel,
      success: catalog.success,
      // Same Mautic form as the contact modal, with the catalog's own CTA label.
      form: { ...contact.form, submit: catalog.submit },
      enhancement: {
        cnpjInvalid: contact.cnpjInvalid,
        cnpjPlaceholder: contact.cnpjPlaceholder,
        phonePlaceholder: contact.phonePlaceholder,
      },
    },
  };

  return (
    <CatalogHero
      content={content}
      navLinks={navLinks}
      menuLabels={{ open: navigation.menu, close: navigation.close }}
      pdfUrl={siteLinks.catalogPdf}
      pdfFileName={CATALOG_PDF_FILENAME}
      privacyUrl={siteLinks.privacy || undefined}
    />
  );
}
