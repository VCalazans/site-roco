import { CredentialsSignin } from "next-auth";
import { CAPTCHA_ERROR, CAPTCHA_UNAVAILABLE_ERROR } from "@/shared/lib/turnstile";

/** `?error=` da tela de login quando a senha confere mas o e-mail ainda não foi confirmado. */
export const EMAIL_NOT_VERIFIED_CODE = "email_not_verified";
/** `?error=` quando estourou o limite de tentativas (por IP ou por e-mail). */
export const LOGIN_RATE_LIMITED_CODE = "rate_limited";
/** `?error=` quando o limitador de tentativas está fora do ar (produção sem Redis). */
export const LOGIN_UNAVAILABLE_CODE = "unavailable";
/** `?error=` quando a verificação anti-robô (Turnstile) recusou a tentativa. */
export const LOGIN_CAPTCHA_CODE = CAPTCHA_ERROR;
/** `?error=` quando não deu para validar o Turnstile (Cloudflare fora do ar): o login recusa (fail-closed). */
export const LOGIN_CAPTCHA_UNAVAILABLE_CODE = CAPTCHA_UNAVAILABLE_ERROR;

/** Códigos que a tela de login sabe explicar; qualquer outro vira o erro genérico. */
export const LOGIN_ERROR_CODES = [
  EMAIL_NOT_VERIFIED_CODE,
  LOGIN_RATE_LIMITED_CODE,
  LOGIN_UNAVAILABLE_CODE,
  LOGIN_CAPTCHA_CODE,
  LOGIN_CAPTCHA_UNAVAILABLE_CODE,
] as const;
export type LoginErrorCode = (typeof LOGIN_ERROR_CODES)[number];

export function isLoginErrorCode(value: unknown): value is LoginErrorCode {
  return typeof value === "string" && (LOGIN_ERROR_CODES as readonly string[]).includes(value);
}

/**
 * Senha correta, e-mail ainda não confirmado pelo link do cadastro. Só é
 * lançado DEPOIS de a senha conferir: quem não tem a senha continua recebendo
 * o erro genérico e não descobre que a conta existe.
 */
export class EmailNotVerifiedError extends CredentialsSignin {
  code = EMAIL_NOT_VERIFIED_CODE;
}

/**
 * Muitas tentativas. Não revela se a conta existe: os limites valem para o IP
 * e para qualquer e-mail digitado, exista a conta ou não.
 */
export class LoginRateLimitedError extends CredentialsSignin {
  code = LOGIN_RATE_LIMITED_CODE;
}

/** Limitador fora do ar em produção: o login recusa (fail-closed) em vez de abrir espaço à força bruta. */
export class LoginUnavailableError extends CredentialsSignin {
  code = LOGIN_UNAVAILABLE_CODE;
}

/**
 * Turnstile recusou (token ausente, inválido ou de outra ação). Checado antes
 * do banco e do bcrypt, então também não revela se a conta existe.
 */
export class LoginCaptchaError extends CredentialsSignin {
  code = LOGIN_CAPTCHA_CODE;
}

/** Não deu para validar o Turnstile agora (rede, timeout, Cloudflare fora do ar): recusa e pede para tentar de novo. */
export class LoginCaptchaUnavailableError extends CredentialsSignin {
  code = LOGIN_CAPTCHA_UNAVAILABLE_CODE;
}
