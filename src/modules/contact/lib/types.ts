import type { Dictionary } from "@/i18n/get-dictionary";

/**
 * Formato da chave `contact` (nível raiz) nos dicionários — copy da página
 * pública de contato (`/{locale}/contato`), destino do CTA "Solicite um
 * orçamento". Espelha `src/i18n/dictionaries/{pt,en}.json`; divergência
 * aparece como erro de tipo em `getContactDictionary`. Mesmo padrão de
 * `src/modules/representatives/lib/types.ts`.
 */
export type ContactDictionary = {
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
    subject: {
      label: string;
      options: {
        callBack: string;
        quote: string;
        general: string;
      };
    };
    message: string;
    productContext: {
      label: string;
      clear: string;
    };
    consent: string;
    submit: string;
    sending: string;
  };
  validation: {
    required: string;
    invalidEmail: string;
    invalidPhone: string;
    invalidCnpj: string;
    consentRequired: string;
    /** Reprovação de FORMATO vinda do servidor (`{ fields: [...] }`). */
    invalid: string;
  };
  errors: {
    rateLimited: string;
    /** 400 cujo campo culpado este formulário nem renderiza. */
    validation: string;
    /** 503 do rate limiter fail-closed — falha nossa, não repetição da pessoa. */
    unavailable: string;
    generic: string;
  };
  success: {
    title: string;
    message: string;
  };
};

export function getContactDictionary(dictionary: Dictionary): ContactDictionary {
  return (dictionary as Dictionary & { contact: ContactDictionary }).contact;
}
