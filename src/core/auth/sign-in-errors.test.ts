import { CredentialsSignin } from "@auth/core/errors";
import { describe, expect, it, vi } from "vitest";

// `next-auth` importa `next/server` sem extensão, o que o resolvedor ESM do
// Node recusa fora do Next. A classe é a mesma que ele reexporta de
// `@auth/core/errors` — o teste usa essa, sem stub.
vi.mock("next-auth", async () => ({ CredentialsSignin: (await import("@auth/core/errors")).CredentialsSignin }));

import {
  EmailNotVerifiedError,
  isLoginErrorCode,
  LOGIN_CAPTCHA_CODE,
  LOGIN_CAPTCHA_UNAVAILABLE_CODE,
  LOGIN_ERROR_CODES,
  LoginCaptchaError,
  LoginCaptchaUnavailableError,
  LoginRateLimitedError,
  LoginUnavailableError,
} from "./sign-in-errors";

describe("isLoginErrorCode", () => {
  it("reconhece os códigos que a tela de login explica", () => {
    for (const code of ["email_not_verified", "rate_limited", "unavailable", "captcha", "captcha_unavailable"]) {
      expect(isLoginErrorCode(code)).toBe(true);
    }
  });

  it("o resto (inclusive senha errada) cai no erro genérico", () => {
    for (const value of ["credentials", "CredentialsSignin", "", "CAPTCHA", undefined, null, 1]) {
      expect(isLoginErrorCode(value)).toBe(false);
    }
  });

  it("os códigos do Turnstile são os mesmos das rotas (`captcha` / `captcha_unavailable`)", () => {
    expect(LOGIN_CAPTCHA_CODE).toBe("captcha");
    expect(LOGIN_CAPTCHA_UNAVAILABLE_CODE).toBe("captcha_unavailable");
  });
});

describe("erros de login", () => {
  it.each([
    [EmailNotVerifiedError, "email_not_verified"],
    [LoginRateLimitedError, "rate_limited"],
    [LoginUnavailableError, "unavailable"],
    [LoginCaptchaError, "captcha"],
    [LoginCaptchaUnavailableError, "captcha_unavailable"],
  ] as const)("%o leva o código `%s` (CredentialsSignin, lido por `loginWithCredentials`)", (ErrorClass, code) => {
    const error = new ErrorClass();
    expect(error).toBeInstanceOf(CredentialsSignin);
    expect(error.code).toBe(code);
    expect(LOGIN_ERROR_CODES).toContain(error.code);
  });
});
