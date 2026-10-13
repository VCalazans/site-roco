import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";
import { AskAiLinks } from "@/modules/ai/components/ask-ai-links";
import { CopyButton } from "@/modules/ai/components/copy-button";

type AskAiPageProps = {
  copy: Dictionary["askAi"];
  prompt: string;
  mcpUrl: string;
  links: { quote: string; contact: string; privacy: string; claudeHelp: string };
};

/**
 * "Tire dúvidas com IA" (spec 003) — para o CLIENTE, não para desenvolvedor:
 * 1) perguntar já, no assistente que ele usa (pergunta pronta);
 * 2) como chegar ao orçamento (o envio é sempre dele, no site);
 * 3) conectar o catálogo oficial (MCP) no Claude/ChatGPT de uso diário.
 */
export function AskAiPage({ copy, prompt, mcpUrl, links }: AskAiPageProps) {
  const assistants = [
    { key: "claude", title: copy.claude.title, steps: copy.claude.steps, help: copy.claude.help, helpUrl: links.claudeHelp },
    { key: "chatgpt", title: copy.chatgpt.title, steps: copy.chatgpt.steps, help: null, helpUrl: null },
  ];

  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-[#05070b]">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-1/4 size-[34rem] rounded-full bg-neon-cyan/15 blur-[140px]" />
        <div className="absolute -right-40 bottom-0 size-[30rem] rounded-full bg-neon-amber/10 blur-[140px]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-5xl px-5 pb-16 pt-24 sm:px-6 md:pt-32">
        <p className="text-glow-cyan text-meta font-semibold uppercase tracking-[0.2em] text-neon-cyan-bright">
          {copy.eyebrow}
        </p>
        <h1 className="text-glow-soft mt-3 max-w-3xl font-display text-h1 text-white">{copy.headline}</h1>
        <p className="mt-4 max-w-2xl text-body text-white/80">{copy.intro}</p>

        <section aria-labelledby="ia-perguntar" className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 id="ia-perguntar" className="font-display text-h2 text-white">
            {copy.askTitle}
          </h2>
          <p className="mt-1 text-meta text-white/60">{copy.askHint}</p>
          <AskAiLinks prompt={prompt} copy={copy} className="mt-5" />

          <h3 className="mt-8 text-meta font-semibold uppercase tracking-[0.12em] text-neon-cyan-bright">
            {copy.examplesTitle}
          </h3>
          <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {copy.examples.map((example) => (
              <li key={example} className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-meta text-white/75">
                {example}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="ia-orcamento" className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 id="ia-orcamento" className="font-display text-h2 text-white">
            {copy.quoteTitle}
          </h2>
          <p className="mt-2 max-w-3xl text-body text-white/80">{copy.quoteBody}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={links.quote} className="btn-neon w-fit">
              {copy.quoteCta}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link href={links.contact} className="btn-neon btn-neon--amber w-fit">
              {copy.contactCta}
            </Link>
          </div>
        </section>

        <section aria-labelledby="ia-conectar" className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 id="ia-conectar" className="font-display text-h2 text-white">
            {copy.connectTitle}
          </h2>
          <p className="mt-2 max-w-3xl text-body text-white/80">{copy.connectIntro}</p>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0">
              <p className="text-meta text-white/60">{copy.urlLabel}</p>
              <code className="mt-1 block break-all rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-ui text-neon-cyan-bright">
                {mcpUrl}
              </code>
            </div>
            <CopyButton value={mcpUrl} label={copy.copy} copiedLabel={copy.copied} />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            {assistants.map((assistant) => (
              <div key={assistant.key}>
                <h3 className="text-ui font-semibold text-white">{assistant.title}</h3>
                <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5 text-meta text-white/75">
                  {assistant.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                {assistant.help && assistant.helpUrl ? (
                  <a
                    href={assistant.helpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-meta text-neon-cyan-bright underline-offset-4 hover:underline"
                  >
                    {assistant.help}
                    <span className="sr-only"> {copy.newTab}</span>
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <p className="mt-8 max-w-3xl text-meta text-white/60">
          {copy.privacyNote}{" "}
          <Link href={links.privacy} className="text-neon-cyan-bright underline-offset-4 hover:underline">
            {copy.privacyLink}
          </Link>
        </p>
      </div>
    </div>
  );
}
