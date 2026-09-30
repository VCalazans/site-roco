import { describe, expect, it } from "vitest";
import { accountPageLink, getAppBaseUrl } from "./app-url";

describe("getAppBaseUrl", () => {
  it("usa AUTH_URL e cai no NEXT_PUBLIC_SITE_URL, só com a origem", () => {
    expect(getAppBaseUrl({ AUTH_URL: "https://roco.com.br/", NEXT_PUBLIC_SITE_URL: "https://outro" })).toBe(
      "https://roco.com.br"
    );
    expect(getAppBaseUrl({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000/qualquer/caminho" })).toBe(
      "http://localhost:3000"
    );
  });

  it("ignora valor inválido ou de outro protocolo e devolve null sem nada", () => {
    expect(getAppBaseUrl({ AUTH_URL: "roco.com.br", NEXT_PUBLIC_SITE_URL: "https://roco.com.br" })).toBe(
      "https://roco.com.br"
    );
    expect(getAppBaseUrl({ AUTH_URL: "javascript:alert(1)" })).toBeNull();
    expect(getAppBaseUrl({})).toBeNull();
  });
});

describe("accountPageLink", () => {
  it("põe o token no fragmento, nunca na querystring", () => {
    expect(accountPageLink("https://roco.com.br", "pt", "redefinir-senha", "abc_DEF-123")).toBe(
      "https://roco.com.br/pt/portal/redefinir-senha#token=abc_DEF-123"
    );
    expect(accountPageLink("https://roco.com.br", "en", "esqueci-senha")).toBe(
      "https://roco.com.br/en/portal/esqueci-senha"
    );
  });
});
