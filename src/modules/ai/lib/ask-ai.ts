/**
 * "Pergunte à IA" (spec 003) — links que abrem o assistente do visitante com
 * a pergunta já escrita. Não há integração nem dado pessoal: é só uma URL
 * pública de cada serviço com o texto na querystring. O visitante pode editar
 * a pergunta antes de enviar.
 *
 * Puro: sem I/O, testável.
 */

export const ASK_AI_ASSISTANTS = ["chatgpt", "claude", "perplexity"] as const;
export type AskAiAssistant = (typeof ASK_AI_ASSISTANTS)[number];

/** Endereço de cada serviço que aceita a pergunta pronta em `?q=`. */
const ASSISTANT_URLS: Record<AskAiAssistant, string> = {
  chatgpt: "https://chatgpt.com/",
  claude: "https://claude.ai/new",
  perplexity: "https://www.perplexity.ai/search",
};

/** Teto do texto na URL: perguntas longas viram URLs que alguns navegadores cortam. */
export const MAX_PROMPT_LENGTH = 1500;

export function askAiUrl(assistant: AskAiAssistant, prompt: string): string {
  const url = new URL(ASSISTANT_URLS[assistant]);
  url.searchParams.set("q", prompt.replace(/\s+/g, " ").trim().slice(0, MAX_PROMPT_LENGTH));
  return url.toString();
}

export function askAiLinks(prompt: string): { assistant: AskAiAssistant; url: string }[] {
  return ASK_AI_ASSISTANTS.map((assistant) => ({ assistant, url: askAiUrl(assistant, prompt) }));
}

/**
 * Link OFICIAL do Claude que abre "Adicionar conector personalizado" com nome e
 * URL já preenchidos (documentado em claude.com/docs/connectors/building/
 * directory-vs-custom, conferido em 2026-10-13). A pessoa só confere e confirma;
 * sem login, o Claude pede para entrar e depois mostra o formulário preenchido.
 */
export function claudeConnectorInstallUrl(name: string, mcpUrl: string): string {
  const url = new URL("https://claude.ai/customize/connectors");
  url.searchParams.set("modal", "add-custom-connector");
  url.searchParams.set("connectorName", name);
  url.searchParams.set("connectorUrl", mcpUrl);
  return url.toString();
}
