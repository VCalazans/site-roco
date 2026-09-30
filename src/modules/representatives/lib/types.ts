import type { Dictionary } from "@/i18n/get-dictionary";

/**
 * Formato da chave `representatives` (nível raiz) nos dicionários — copy do
 * canal público de pré-cadastro de representantes (`/{locale}/representantes`).
 * Espelha `src/i18n/dictionaries/{pt,en}.json`; divergência aparece como erro
 * de tipo em `getRepresentativesDictionary`.
 */
export type RepresentativesDictionary = {
  seo: { title: string; description: string };
  headline: string;
  subheadline: string;
  intro: string;
  form: {
    title: string;
    name: string;
    email: string;
    phone: string;
    companyName: string;
    cnpj: string;
    password: string;
    passwordConfirm: string;
    passwordHint: string;
    submit: string;
    sending: string;
  };
  validation: {
    required: string;
    /** Nome com algo além de letras, espaço, apóstrofo, ponto e hífen. */
    invalidName: string;
    invalidEmail: string;
    invalidCnpj: string;
    invalidPhone: string;
    passwordTooShort: string;
    passwordMismatch: string;
    passwordTooLong: string;
    passwordTooCommon: string;
    passwordContainsEmail: string;
  };
  errors: {
    emailExists: string;
    cnpjExists: string;
    rateLimited: string;
    generic: string;
    unavailable: string;
  };
  /** Depois do envio: confirmar o e-mail (link por e-mail, 24 h). */
  success: {
    title: string;
    /** Placeholder literal `{email}`. */
    message: string;
    spamHint: string;
    resendButton: string;
    resending: string;
    resent: string;
    resendError: string;
    loginCta: string;
  };
  loginPrompt: string;
  loginLink: string;
  lgpd: string;
};

export function getRepresentativesDictionary(
  dictionary: Dictionary
): RepresentativesDictionary {
  return (dictionary as Dictionary & { representatives: RepresentativesDictionary })
    .representatives;
}
