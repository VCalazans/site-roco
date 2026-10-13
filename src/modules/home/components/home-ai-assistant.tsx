import Link from "next/link";
import { ArrowRight, ExternalLink, Sparkles } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { ResolvedHomeContent } from "@/modules/home/lib/home-content";
import { externalProps } from "@/shared/lib/nav";

type HomeAiAssistantProps = {
  content: ResolvedHomeContent["aiAssistant"];
  /** Passos e botão "Conectar ao Claude" — fixos, do dicionário. */
  copy: Pick<Dictionary["home"]["aiAssistant"], "steps" | "connectCta" | "newTab">;
  ctaHref: string;
  /** Link oficial do Claude que abre o conector da ROCO já preenchido. */
  claudeInstallUrl: string;
};

/**
 * Chamada "ROCO na sua IA" (spec 003): orienta o cliente a conectar o catálogo
 * ao Claude/ChatGPT, perguntar e pedir o orçamento. Textos e o botão "Ver como
 * funciona" são editáveis no painel; o passo a passo detalhado fica em `/ia`.
 */
export function HomeAiAssistant({ content, copy, ctaHref, claudeInstallUrl }: HomeAiAssistantProps) {
  return (
    <section id="ia" aria-labelledby="home-ia-titulo" className="relative scroll-mt-20 px-6 py-16 sm:py-20">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl border border-neon-cyan/25 bg-white/[0.03] px-6 py-10 shadow-[0_30px_80px_-40px_rgba(53,217,255,0.45)] sm:px-10 sm:py-12">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -right-24 -top-24 size-[22rem] rounded-full bg-neon-cyan/10 blur-[120px]" />
          <div className="absolute -bottom-24 -left-24 size-[22rem] rounded-full bg-neon-amber/10 blur-[120px]" />
        </div>

        <div className="relative grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
          <div>
            <p className="text-glow-cyan inline-flex items-center gap-2 text-meta font-semibold uppercase tracking-[0.2em] text-neon-cyan-bright">
              <Sparkles className="size-4" aria-hidden />
              {content.eyebrow}
            </p>
            <h2 id="home-ia-titulo" className="mt-3 font-display text-h1 text-white">
              {content.headline}
            </h2>
            <p className="mt-4 text-body text-white/75">{content.description}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href={claudeInstallUrl} target="_blank" rel="noopener noreferrer" className="btn-neon w-fit">
                {copy.connectCta}
                <ExternalLink className="size-4" aria-hidden />
                <span className="sr-only">{copy.newTab}</span>
              </a>
              <Link href={ctaHref} {...externalProps(ctaHref)} className="btn-neon btn-neon--amber w-fit">
                {content.cta.label}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          </div>

          <ol className="grid grid-cols-1 gap-3">
            {copy.steps.map((step, index) => (
              <li
                key={step.title}
                className="rounded-2xl border border-white/10 bg-black/20 px-5 py-4"
                style={{
                  boxShadow:
                    index % 2 === 0
                      ? "0 0 24px -10px rgba(53, 217, 255, 0.35)"
                      : "0 0 24px -10px rgba(245, 163, 60, 0.35)",
                }}
              >
                <p className={index % 2 === 0 ? "text-ui font-semibold text-neon-cyan-bright" : "text-ui font-semibold text-neon-amber-bright"}>
                  {step.title}
                </p>
                <p className="mt-1 text-meta text-white/70">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
