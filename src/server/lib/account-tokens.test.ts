import { describe, expect, it } from "vitest";
import {
  ACCOUNT_TOKEN_TTL_MS,
  accountTokenExpiry,
  emailRateLimitKey,
  mailboxOf,
  mailboxRateLimitKey,
  evaluateAccountToken,
  generateAccountToken,
  hashAccountToken,
  isWellFormedAccountToken,
} from "./account-tokens";

describe("generateAccountToken", () => {
  it("gera 43 caracteres base64url e devolve o SHA-256 dele", () => {
    const { token, tokenHash } = generateAccountToken();
    expect(isWellFormedAccountToken(token)).toBe(true);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).toBe(hashAccountToken(token));
  });

  it("nunca repete (amostra de mil)", () => {
    const tokens = new Set(Array.from({ length: 1000 }, () => generateAccountToken().token));
    expect(tokens.size).toBe(1000);
  });
});

describe("isWellFormedAccountToken", () => {
  it("recusa qualquer coisa fora do formato", () => {
    for (const bad of [undefined, null, 123, "", "curto", `${"a".repeat(43)}=`, "a".repeat(44), `${"a".repeat(42)}!`]) {
      expect(isWellFormedAccountToken(bad)).toBe(false);
    }
  });
});

describe("evaluateAccountToken", () => {
  const now = new Date("2026-09-30T12:00:00Z");

  it("distingue inexistente, usado, vencido e válido", () => {
    expect(evaluateAccountToken(undefined, now)).toBe("invalid");
    expect(evaluateAccountToken({ expiresAt: new Date("2026-09-30T13:00:00Z"), usedAt: now }, now)).toBe("used");
    expect(evaluateAccountToken({ expiresAt: now, usedAt: null }, now)).toBe("expired");
    expect(evaluateAccountToken({ expiresAt: new Date("2026-09-30T12:00:01Z"), usedAt: null }, now)).toBe("valid");
  });
});

describe("accountTokenExpiry", () => {
  it("redefinição de senha vale 60 min; confirmação de e-mail, 24 h", () => {
    const now = new Date("2026-09-30T12:00:00Z");
    expect(accountTokenExpiry("password_reset", now).toISOString()).toBe("2026-09-30T13:00:00.000Z");
    expect(accountTokenExpiry("email_verification", now).getTime() - now.getTime()).toBe(
      ACCOUNT_TOKEN_TTL_MS.email_verification
    );
  });
});

describe("emailRateLimitKey", () => {
  it("não expõe o e-mail e ignora caixa e espaços", () => {
    const key = emailRateLimitKey("account:forgot", " Ana@Empresa.com ");
    expect(key).toBe(emailRateLimitKey("account:forgot", "ana@empresa.com"));
    expect(key).not.toContain("ana");
    expect(key).toMatch(/^account:forgot:email:[0-9a-f]{32}$/);
  });
});

describe("mailboxOf / mailboxRateLimitKey", () => {
  it("tira o sub-endereço (+tag): as variações contam como a mesma caixa", () => {
    expect(mailboxOf(" Maria+1@Empresa.com ")).toBe("maria@empresa.com");
    expect(mailboxOf("maria+promo+x@empresa.com")).toBe("maria@empresa.com");
    expect(mailboxOf("maria@empresa.com")).toBe("maria@empresa.com");
    expect(mailboxRateLimitKey("register", "maria+1@empresa.com")).toBe(mailboxRateLimitKey("register", "MARIA+2@empresa.com"));
  });

  it("não quebra com endereço estranho e não guarda o e-mail em claro", () => {
    expect(mailboxOf("+tag@empresa.com")).toBe("+tag@empresa.com");
    expect(mailboxOf("sem-arroba")).toBe("sem-arroba");
    const key = mailboxRateLimitKey("register", "maria@empresa.com");
    expect(key).toMatch(/^register:mailbox:[0-9a-f]{32}$/);
    expect(key).not.toContain("maria");
  });
});
