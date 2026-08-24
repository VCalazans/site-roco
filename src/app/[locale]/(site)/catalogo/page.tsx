import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { getCatalogPdfUrl } from "@/server/lib/site-settings";
import { locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

/**
 * Landing de download do catálogo em PDF.
 *
 * Escrita em Tailwind, não MUI: esta rota vive no route group `(site)`, que por
 * arquitetura é Tailwind-only — MUI é do `(internal)` (ver systemPatterns,
 * "MUI + Tailwind: Coexistência"). A versão anterior usava componentes MUI aqui
 * e quebrava a página inteira com HTTP 500:
 *
 *   Error: Functions cannot be passed directly to Client Components
 *   {component: function i, href, download, ...}
 *
 * O `<Button component={Link}>` do MUI passa um COMPONENTE (função) como prop de
 * um Server Component para um Client Component, o que o React Server Components
 * proíbe. Um `<a download>` puro resolve sem ceder nada: o link continua sendo
 * um download direto e a página segue 100% server-rendered.
 */

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
  const { catalog } = dictionary;
  const pdfUrl = await getCatalogPdfUrl();

  return (
    <main className="bg-background">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 px-6 py-20 text-center md:py-28">
        <div className="relative h-60 w-60 overflow-hidden rounded-full shadow-[0_0_60px_-10px_rgba(53,217,255,0.35)] md:h-80 md:w-80">
          <Image
            src="/images/hero/hero-stage.jpg"
            alt={catalog.sceneAlt}
            fill
            priority
            sizes="(max-width: 768px) 240px, 320px"
            className="object-cover"
          />
        </div>

        <div className="flex flex-col items-center gap-4">
          <p className="text-glow-amber text-meta font-semibold uppercase tracking-[0.2em] text-neon-amber-bright">
            {dictionary.navigation.brand}
          </p>
          <h1 className="font-display text-balance text-3xl font-semibold tracking-tight md:text-5xl">
            {catalog.headline}
          </h1>
          <p className="max-w-xl text-white/70">{catalog.description}</p>
        </div>

        {/* `<a download>` e não `next/link`: o alvo é um PDF (possivelmente em
            outro domínio, ex. R2), então não há rota interna para prefetch — e
            o `download` precisa chegar cru no elemento. */}
        <a href={pdfUrl} download className="btn-neon">
          {catalog.submit}
        </a>
      </div>
    </main>
  );
}
