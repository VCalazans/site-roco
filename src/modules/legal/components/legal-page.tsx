import type { LegalDocument } from "@/modules/legal/lib/legal-content";

type LegalPageProps = {
  document: LegalDocument;
  common: { updatedLabel: string; updatedDate: string; tocLabel: string; contactTitle: string; contactBody: string };
};

/**
 * Página legal do site público (Privacidade, Termos, Cookies). Texto longo:
 * medida de leitura limitada, índice com âncoras e títulos com `scroll-mt`
 * para não ficarem sob o header fixo.
 */
export function LegalPage({ document, common }: LegalPageProps) {
  return (
    <div className="relative min-h-[100svh] w-full bg-[#05070b]">
      <article className="mx-auto w-full max-w-3xl px-5 pb-20 pt-28 sm:px-6 md:pt-36">
        <h1 className="text-glow-soft font-display text-h1 text-white">{document.title}</h1>
        <p className="mt-3 text-meta text-white/60">
          {common.updatedLabel} {common.updatedDate}
        </p>

        <div className="mt-6 flex flex-col gap-4">
          {document.intro.map((paragraph, index) => (
            <p key={index} className="text-body text-white/80">
              {paragraph}
            </p>
          ))}
        </div>

        <nav aria-labelledby="legal-toc" className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 id="legal-toc" className="text-meta font-semibold uppercase tracking-[0.12em] text-neon-cyan-bright">
            {common.tocLabel}
          </h2>
          <ol className="mt-3 flex list-decimal flex-col gap-1.5 pl-5 text-meta text-white/75">
            {document.sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="transition hover:text-neon-cyan-bright">
                  {section.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {document.sections.map((section, index) => (
          <section key={section.id} id={section.id} aria-labelledby={`${section.id}-titulo`} className="mt-10 scroll-mt-28">
            <h2 id={`${section.id}-titulo`} className="font-display text-h2 text-white">
              {index + 1}. {section.heading}
            </h2>
            {section.paragraphs.map((paragraph, paragraphIndex) => (
              <p key={paragraphIndex} className="mt-3 text-body text-white/80">
                {paragraph}
              </p>
            ))}
            {section.items.length > 0 ? (
              <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-body text-white/80">
                {section.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}

        <section aria-labelledby="legal-contato" className="mt-12 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 id="legal-contato" className="font-display text-h2 text-white">
            {common.contactTitle}
          </h2>
          <p className="mt-2 text-body text-white/80">{common.contactBody}</p>
        </section>
      </article>
    </div>
  );
}
