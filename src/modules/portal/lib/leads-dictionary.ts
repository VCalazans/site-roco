import type { Dictionary } from "@/i18n/get-dictionary";
import type { ContactSubject } from "@/server/lib/contact-submit";
import type { LeadOrigin } from "@/shared/lib/lead-origin";

/**
 * Formato de `portal.leads` nos dicionários (`src/i18n/dictionaries/{pt,en}.json`)
 * — caixa de "Solicitações" do portal (`/portal/solicitacoes`, spec 001, RF29).
 *
 * `subjects` e `origins` são `Record` sobre as listas FECHADAS do sistema
 * (`ContactSubject`, `LeadOrigin`): acrescentar um assunto ou uma origem sem
 * dar rótulo a ele quebra `tsc` no teste `leads-dictionary.test.ts` (que
 * atribui os JSONs a este tipo), em vez de mostrar o slug cru na tela.
 *
 * IMPORTANTE (copy): o assunto técnico `cart` é a "Lista de orçamento" na UI —
 * a palavra "carrinho" não pode aparecer em nenhum texto visível.
 *
 * Placeholders `{chave}` são resolvidos com `interpolate()`.
 */
export type PortalLeadsDictionary = {
  title: string;
  subtitle: string;
  refresh: string;
  search: {
    label: string;
    placeholder: string;
  };
  filters: {
    all: string;
    subjectAria: string;
  };
  subjects: Record<ContactSubject, string>;
  table: {
    receivedAt: string;
    name: string;
    company: string;
    subject: string;
    items: string;
    origin: string;
    channels: string;
    actions: string;
    /** `{name}` */
    viewDetails: string;
  };
  items: {
    /** `{count}` */
    productsOne: string;
    /** `{count}` */
    productsOther: string;
    /** `{count}` */
    unitsOne: string;
    /** `{count}` */
    unitsOther: string;
    /** `{products}`, `{units}` */
    listSummary: string;
    /** `{sku}` */
    sku: string;
  };
  origins: Record<LeadOrigin, string>;
  channels: {
    rdStation: string;
    /** Rótulo curto do chip da tabela (a coluna é estreita). */
    rdStationShort: string;
    email: string;
    /** `{channel}`, `{status}` */
    tooltip: string;
    status: {
      sent: string;
      failed: string;
      pending: string;
      not_configured: string;
      skipped: string;
      unknown: string;
    };
  };
  empty: {
    title: string;
    description: string;
    filteredTitle: string;
    filteredDescription: string;
    clearFilters: string;
  };
  error: {
    title: string;
    description: string;
    retry: string;
  };
  detail: {
    close: string;
    newTab: string;
    sections: {
      contact: string;
      request: string;
      message: string;
      products: string;
      delivery: string;
    };
    fields: {
      name: string;
      email: string;
      phone: string;
      company: string;
      cnpj: string;
      subject: string;
      receivedAt: string;
      origin: string;
      campaign: string;
      language: string;
      consent: string;
    };
    languages: {
      pt: string;
      en: string;
    };
    /** `{source}`, `{medium}`, `{campaign}` — cada parte só entra se existir. */
    campaign: {
      source: string;
      medium: string;
      campaign: string;
    };
    /** `{date}` */
    consentGranted: string;
    consentMissing: string;
    noMessage: string;
    singleProduct: string;
    itemsTable: {
      product: string;
      sku: string;
      quantity: string;
      viewOnSite: string;
    };
    delivery: {
      description: string;
      rdStation: string;
      email: string;
      /** `{error}` */
      reason: string;
      errors: {
        not_configured: string;
        missing_api_key: string;
        validation: string;
        validation_retry_ok: string;
        validation_retry_failed: string;
        rate_limited: string;
        network: string;
        /** `{code}` */
        http: string;
        /** `{code}` */
        unknown: string;
      };
    };
    actions: {
      replyEmail: string;
      whatsapp: string;
      copyEmail: string;
      copied: string;
      copyFailed: string;
      openWhatsapp: string;
    };
    /** `{subject}` */
    replySubject: string;
    /** `{name}` */
    replyGreeting: string;
    /** `{name}` */
    whatsappGreeting: string;
    error: {
      description: string;
      notFound: string;
      retry: string;
    };
  };
};

/** Mesmo cast estrutural de `getPortalDictionary` (`types.ts`). */
export function getPortalLeadsDictionary(dictionary: Dictionary): PortalLeadsDictionary {
  return (dictionary as Dictionary & { portal: { leads: PortalLeadsDictionary } }).portal.leads;
}
