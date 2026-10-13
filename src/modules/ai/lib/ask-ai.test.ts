import { describe, expect, it } from "vitest";
import { ASK_AI_ASSISTANTS, askAiLinks, askAiUrl, MAX_PROMPT_LENGTH } from "@/modules/ai/lib/ask-ai";

describe("askAiUrl", () => {
  it("abre cada assistente com a pergunta em ?q=", () => {
    expect(askAiUrl("chatgpt", "Olá ROCO")).toBe("https://chatgpt.com/?q=Ol%C3%A1+ROCO");
    expect(askAiUrl("claude", "Olá ROCO")).toBe("https://claude.ai/new?q=Ol%C3%A1+ROCO");
    expect(askAiUrl("perplexity", "Olá ROCO")).toBe("https://www.perplexity.ai/search?q=Ol%C3%A1+ROCO");
  });

  it("junta espaços e quebras de linha e corta no teto", () => {
    const url = new URL(askAiUrl("chatgpt", `  a\n\n  b  ${"x".repeat(MAX_PROMPT_LENGTH * 2)}`));
    const q = url.searchParams.get("q") ?? "";
    expect(q.startsWith("a b x")).toBe(true);
    expect(q).toHaveLength(MAX_PROMPT_LENGTH);
  });

  it("codifica caracteres que quebrariam a URL", () => {
    const url = new URL(askAiUrl("claude", 'produto "1/2" & cia #1'));
    expect(url.searchParams.get("q")).toBe('produto "1/2" & cia #1');
    expect(url.hash).toBe("");
  });
});

describe("askAiLinks", () => {
  it("devolve um link por assistente, na ordem fixa", () => {
    expect(askAiLinks("x").map((link) => link.assistant)).toEqual([...ASK_AI_ASSISTANTS]);
  });
});

describe("claudeConnectorInstallUrl", () => {
  it("monta o link oficial que abre o conector já preenchido", async () => {
    const { claudeConnectorInstallUrl } = await import("@/modules/ai/lib/ask-ai");
    expect(claudeConnectorInstallUrl("ROCO", "https://roco.com.br/mcp")).toBe(
      "https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=ROCO&connectorUrl=https%3A%2F%2Froco.com.br%2Fmcp"
    );
  });
});
