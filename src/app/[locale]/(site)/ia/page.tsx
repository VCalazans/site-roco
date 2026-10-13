import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { absoluteUrl, buildAlternates } from "@/core/config/metadata";
import { ASK_AI_SEGMENT, askAiPath, contactPath, privacyPath, quotePath } from "@/core/config/site";
import { locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { AskAiPage } from "@/modules/ai/components/ask-ai-page";
import { claudeConnectorInstallUrl } from "@/modules/ai/lib/ask-ai";
import { buildBreadcrumbList } from "@/modules/ai/lib/json-ld";
import { MCP_PATH } from "@/modules/ai/server/mcp-server";
import { JsonLd } from "@/shared/components/seo/json-ld";
import { withLeadOrigin } from "@/shared/lib/lead-origin";
import { interpolate } from "@/shared/lib/interpolate";

type PageProps = { params: Promise<{ locale: Locale }> };

/** Ajuda oficial do Claude sobre conectores personalizados (conferida em 2026-10-13). */
const CLAUDE_CONNECTORS_HELP =
  "https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!locales.includes(locale)) notFound();
  const { askAi } = await getDictionary(locale);
  return {
    title: askAi.seo.title,
    description: askAi.seo.description,
    alternates: buildAlternates(locale, `/${ASK_AI_SEGMENT}`),
  };
}

/** "Tire dúvidas com IA" (spec 003): perguntar no ChatGPT/Claude/Perplexity e conectar o catálogo (MCP). */
export default async function AskAiRoute({ params }: PageProps) {
  const { locale } = await params;
  if (!locales.includes(locale)) notFound();

  const dictionary = await getDictionary(locale);
  const { askAi } = dictionary;
  const context = { siteUrl: absoluteUrl(`/${locale}`), llmsUrl: absoluteUrl("/llms.txt") };
  const prompt = interpolate(askAi.prompts.general, context);
  // As perguntas de exemplo já pedem o conector da ROCO: vão como estão.
  const examples = askAi.examples.map((question) => ({ question, prompt: question }));

  return (
    <>
      <JsonLd
        data={buildBreadcrumbList([
          { name: dictionary.products.detail.breadcrumbHome, path: `/${locale}` },
          { name: askAi.breadcrumb, path: askAiPath(locale) },
        ])}
      />
      <AskAiPage
        copy={askAi}
        prompt={prompt}
        examples={examples}
        mcpUrl={absoluteUrl(MCP_PATH)}
        links={{
          quote: quotePath(locale),
          contact: withLeadOrigin(contactPath(locale), "assistente-ia"),
          privacy: privacyPath(locale),
          claudeHelp: CLAUDE_CONNECTORS_HELP,
          claudeInstall: claudeConnectorInstallUrl(dictionary.navigation.brand, absoluteUrl(MCP_PATH)),
        }}
      />
    </>
  );
}
