import { interpolate } from "@/shared/lib/interpolate";

/**
 * Páginas legais (Privacidade, Termos, Cookies) — o texto vem do dicionário
 * (`legal.*`) e os marcadores {company}, {address}, {email} e {siteUrl} são
 * trocados pelos dados reais do rodapé (`site_settings`). Marcador sem dado
 * vira texto genérico do próprio documento, nunca "{email}" cru na página.
 */
export type LegalSection = { id: string; heading: string; paragraphs: string[]; items: string[] };
export type LegalDocument = {
  seo: { title: string; description: string };
  title: string;
  intro: string[];
  sections: LegalSection[];
};

export type LegalValues = { company: string; address: string; email: string; siteUrl: string };

export function fillLegalText(text: string, values: LegalValues): string {
  return interpolate(text, values).replace(/\s+([,.;:])/g, "$1");
}

export function fillLegalDocument(document: LegalDocument, values: LegalValues): LegalDocument {
  const fill = (text: string) => fillLegalText(text, values);
  return {
    seo: { title: fill(document.seo.title), description: fill(document.seo.description) },
    title: fill(document.title),
    intro: document.intro.map(fill),
    sections: document.sections.map((section) => ({
      id: section.id,
      heading: fill(section.heading),
      paragraphs: section.paragraphs.map(fill),
      items: section.items.map(fill),
    })),
  };
}
