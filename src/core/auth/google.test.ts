import { describe, expect, it } from "vitest";
import { isGoogleSignInEnabled } from "./google";

describe("isGoogleSignInEnabled", () => {
  const credentials = { AUTH_GOOGLE_ID: "id", AUTH_GOOGLE_SECRET: "secret" };

  it("desligado por padrão, mesmo com as credenciais do OAuth", () => {
    expect(isGoogleSignInEnabled({})).toBe(false);
    expect(isGoogleSignInEnabled(credentials)).toBe(false);
    expect(isGoogleSignInEnabled({ ...credentials, AUTH_GOOGLE_ENABLED: "false" })).toBe(false);
  });

  it("liga só com a flag explícita E as credenciais", () => {
    expect(isGoogleSignInEnabled({ ...credentials, AUTH_GOOGLE_ENABLED: "true" })).toBe(true);
    expect(isGoogleSignInEnabled({ AUTH_GOOGLE_ENABLED: "true", AUTH_GOOGLE_ID: "id" })).toBe(false);
  });
});
