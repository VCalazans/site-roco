import type { Dictionary } from "@/i18n/get-dictionary";

/**
 * Formato da chave `catalog` (nível raiz) nos dicionários — copy da landing
 * de catálogo (`/{locale}/catalogo`), onde o PDF fica atrás do formulário de
 * captura. Espelha `src/i18n/dictionaries/{pt,en}.json`.
 *
 * Parte das chaves (`formTitle`, `privacyNotice`, `privacyLabel`,
 * `success.*`) sobrou da era Mautic, quando esta página já embutia um
 * formulário; foram reaproveitadas em vez de recriadas com outro nome.
 */
export type CatalogDictionary = {
  seo: { title: string; description: string };
  headline: string;
  description: string;
  sceneAlt: string;
  formTitle: string;
  fields: {
    name: string;
    email: string;
    phone: string;
    companyName: string;
  };
  consent: string;
  submit: string;
  sending: string;
  privacyNotice: string;
  privacyLabel: string;
  validation: {
    required: string;
    nameTooShort: string;
    invalidEmail: string;
    invalidPhone: string;
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
    description: string;
    action: string;
  };
};

/**
 * Retorno DIRETO (sem cast), ao contrário de `getContactDictionary` e
 * `getRepresentativesDictionary`: `Dictionary` é a UNIÃO dos tipos inferidos
 * de `pt.json` e `en.json`, então atribuir `dictionary.catalog` a
 * `CatalogDictionary` obriga o `tsc` a conferir as DUAS árvores. Chave que
 * falte (ou mude de forma) em qualquer um dos idiomas quebra `npm run build`
 * — que é a verificação programática de paridade pedida pelo projeto. Um
 * cast só silenciaria essa checagem.
 */
export function getCatalogDictionary(dictionary: Dictionary): CatalogDictionary {
  return dictionary.catalog;
}
