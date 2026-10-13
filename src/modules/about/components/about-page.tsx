import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/core/lib/utils";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { CategoryFact } from "@/modules/ai/server/site-facts";
import type { PublicCertification } from "@/modules/certifications/lib/certifications";
import { interpolate } from "@/shared/lib/interpolate";

type AboutPageProps = {
  about: Dictionary["about"];
  organization: Dictionary["ai"]["organization"];
  /** Selos vigentes, cadastrados no portal. */
  certifications: PublicCertification[];
  /** Parágrafos institucionais — os MESMOS da seção "Quem é a ROCO" da home (editáveis no painel). */
  paragraphs: string[];
  contact: { addressHeadquarters: string; addressPlant: string };
  categories: CategoryFact[];
  totalProducts: number;
  links: { products: string; contact: string; representatives: string; category: (slug: string) => string };
};

/**
 * Página institucional `/{locale}/sobre` (spec 003). Existe para a IA e o
 * buscador terem UMA página com os fatos da empresa — os mesmos do JSON-LD
 * `Organization` e do `llms.txt`: razão social, fundação, matriz, fábrica,
 * mercados, catálogo real e certificação com vigência. Nada aqui é número
 * inventado: textos do dicionário/painel, endereços do rodapé, contagens do banco.
 */
export function AboutPage({
  about,
  organization,
  certifications,
  paragraphs,
  contact,
  categories,
  totalProducts,
  links,
}: AboutPageProps) {
  const facts = [
    { label: about.facts.legalName, value: organization.legalName },
    { label: about.facts.founded, value: organization.foundingYear },
    { label: about.facts.headquarters, value: contact.addressHeadquarters },
    { label: about.facts.plant, value: contact.addressPlant },
    { label: about.facts.market, value: about.market },
    {
      label: about.facts.catalog,
      value: totalProducts > 0
        ? interpolate(about.catalogValue, { totalProducts, totalCategories: categories.length })
        : "",
    },
  ].filter((fact) => fact.value);

  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-[#05070b]">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-1/4 size-[34rem] rounded-full bg-neon-cyan/15 blur-[140px]" />
        <div className="absolute -right-40 bottom-0 size-[30rem] rounded-full bg-neon-amber/10 blur-[140px]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-16 pt-24 sm:px-6 md:pt-32">
        <p className="text-glow-cyan text-meta font-semibold uppercase tracking-[0.2em] text-neon-cyan-bright">
          {about.eyebrow}
        </p>
        <h1 className="text-glow-soft mt-3 max-w-3xl font-display text-h1 text-white">{about.headline}</h1>

        <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16">
          <div className="flex flex-col gap-4">
            {paragraphs.map((paragraph, index) => (
              <p key={index} className="text-body text-white/80">
                {paragraph}
              </p>
            ))}
            <div className="mt-2 flex flex-wrap gap-3">
              <Link href={links.products} className="btn-neon w-fit">
                {about.ctaProducts}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link href={links.contact} className="btn-neon btn-neon--amber w-fit">
                {about.ctaContact}
              </Link>
            </div>
          </div>

          <section aria-labelledby="sobre-resumo" className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 id="sobre-resumo" className="font-display text-h2 text-white">
              {about.factsTitle}
            </h2>
            <dl className="mt-4 flex flex-col gap-4">
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dt className="text-meta font-semibold uppercase tracking-[0.12em] text-neon-cyan-bright">{fact.label}</dt>
                  <dd className="mt-1 text-body text-white/80">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        {categories.length > 0 ? (
          <section aria-labelledby="sobre-linhas" className="mt-16">
            <h2 id="sobre-linhas" className="font-display text-h2 text-white">
              {about.linesTitle}
            </h2>
            <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((category, index) => (
                <li key={category.slug}>
                  <Link
                    href={links.category(category.slug)}
                    className={cn(
                      "flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-ui text-white transition hover:border-white/25",
                      index % 2 === 0 ? "hover:text-neon-cyan-bright" : "hover:text-neon-amber-bright"
                    )}
                  >
                    <span>{category.name}</span>
                    <span className="text-meta text-white/60">{category.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {certifications.length > 0 ? (
          <section aria-labelledby="sobre-certificacoes" className="mt-16">
            <h2 id="sobre-certificacoes" className="font-display text-h2 text-white">
              {about.certificationsTitle}
            </h2>
            <ul className="mt-6 flex flex-wrap gap-6">
              {certifications.map((item) => (
                <li key={item.id} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <Image src={item.imageUrl} alt={item.alt} width={96} height={161} className="h-24 w-auto" />
                  <div>
                    <p className="text-ui font-semibold text-white">{item.label}</p>
                    <p className="text-meta text-white/70">{item.note}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="sobre-contato" className="mt-16 flex flex-col items-start gap-4">
          <h2 id="sobre-contato" className="font-display text-h2 text-white">
            {about.contactTitle}
          </h2>
          <div className="flex flex-wrap gap-3">
            <Link href={links.contact} className="btn-neon w-fit">
              {about.ctaContact}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link href={links.representatives} className="btn-neon btn-neon--amber w-fit">
              {about.ctaRepresentatives}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
