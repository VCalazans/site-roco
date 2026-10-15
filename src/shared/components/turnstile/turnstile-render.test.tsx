/**
 * Render SSR (sem navegador) dos formulários com a verificação anti-robô
 * (Cloudflare Turnstile), com e sem `NEXT_PUBLIC_TURNSTILE_SITE_KEY`:
 * - sem a site key: nada muda — sem widget, sem aviso, botão liberado;
 * - com a site key: o espaço do widget, o aviso "aguarde a verificação" e o
 *   botão de enviar DESABILITADO até o token chegar (o `useEffect` que carrega
 *   o script da Cloudflare não roda no SSR, então o estado é sempre "sem token").
 * Mesmo critério dos outros `*-render.test.tsx`: `renderToString` pega chave de
 * dicionário faltando e exceção na renderização.
 */
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { ThemeProvider } from "@mui/material/styles";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPortalTheme } from "@/core/theme";
import type { Locale } from "@/i18n/config";
import en from "@/i18n/dictionaries/en.json";
import pt from "@/i18n/dictionaries/pt.json";
import type { CartItem } from "@/shared/lib/cart-store";

const cart = vi.hoisted(() => ({ items: [] as CartItem[] }));

// A lista de orçamento vem do `localStorage`; no SSR ela nasce vazia (e a tela
// mostra o estado vazio, sem formulário). Aqui ela já tem um item.
vi.mock("@/shared/lib/cart-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/lib/cart-store")>()),
  useCartItems: () => cart.items,
}));

import { CartPageView } from "@/modules/cart/components/cart-page-view";
import { CatalogForm } from "@/modules/catalog/components/catalog-form";
import { getCatalogDictionary } from "@/modules/catalog/lib/types";
import { ContactForm } from "@/modules/contact/components/contact-form";
import type { ContactDictionary } from "@/modules/contact/lib/types";
import { EmailLinkRequestForm } from "@/modules/portal/components/account/email-link-request-form";
import type { PortalDictionary } from "@/modules/portal/lib/types";
import { RegisterForm } from "@/modules/representatives/components/register-form";
import type { RepresentativesDictionary } from "@/modules/representatives/lib/types";
import type { Dictionary } from "@/i18n/get-dictionary";
import { TURNSTILE_ACTIONS } from "@/shared/lib/turnstile";

const SITE_KEY = "1x00000000000000000000AA";
const DICTIONARIES: Record<Locale, Dictionary> = { pt, en };

/** Texto como o React o escreve no HTML ("didn't" → "didn&#x27;t"). */
function asHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/** Tag de abertura do (único) botão de envio do formulário. */
function submitButton(html: string): string {
  return html.match(/<button[^>]*type="submit"[^>]*>/)?.[0] ?? "";
}

/** O espaço reservado do widget (o `<div>` onde a Cloudflare injeta o iframe). */
const WIDGET_SLOT = 'style="width:100%;min-height:65px"';

type FormCase = {
  name: string;
  render: (locale: Locale) => ReactElement;
  /** Mensagem "aguarde a verificação" do próprio formulário. */
  pending: (locale: Locale) => string;
};

const FORMS: FormCase[] = [
  {
    name: "contato",
    render: (locale) => (
      <ContactForm content={(DICTIONARIES[locale] as unknown as { contact: ContactDictionary }).contact} locale={locale} whatsappContent={DICTIONARIES[locale].leadWhatsapp} />
    ),
    pending: (locale) => DICTIONARIES[locale].contact.errors.captchaPending,
  },
  {
    name: "catálogo",
    render: (locale) => (
      <CatalogForm
        content={getCatalogDictionary(DICTIONARIES[locale])}
        locale={locale}
        pdfUrl="/downloads/catalogo-roco-2026.pdf"
        origin="catalogo"
        whatsappContent={DICTIONARIES[locale].leadWhatsapp}
      />
    ),
    pending: (locale) => DICTIONARIES[locale].catalog.errors.captchaPending,
  },
  {
    name: "orçamento",
    render: (locale) => <CartPageView content={DICTIONARIES[locale].cart} locale={locale} whatsappContent={DICTIONARIES[locale].leadWhatsapp} />,
    pending: (locale) => DICTIONARIES[locale].cart.errors.captchaPending,
  },
  {
    name: "pré-cadastro de representante",
    render: (locale) => (
      <RegisterForm
        content={(DICTIONARIES[locale] as unknown as { representatives: RepresentativesDictionary }).representatives}
        loginHref={`/${locale}/portal/login`}
        locale={locale}
      />
    ),
    pending: (locale) => DICTIONARIES[locale].representatives.errors.captchaPending,
  },
  {
    name: "pedido de link por e-mail (portal)",
    render: (locale) => {
      const account = (DICTIONARIES[locale].portal as unknown as PortalDictionary).account;
      return (
        <ThemeProvider theme={createPortalTheme(locale)}>
          <EmailLinkRequestForm
            endpoint="/api/account/password/forgot"
            captchaAction={TURNSTILE_ACTIONS.passwordReset}
            locale={locale}
            emailLabel={account.emailLabel}
            buttonLabel={account.forgotPassword.button}
            sentMessage={account.forgotPassword.sent}
            errors={account.errors}
          />
        </ThemeProvider>
      );
    },
    pending: (locale) => (DICTIONARIES[locale].portal as unknown as PortalDictionary).account.errors.captchaPending,
  },
];

beforeEach(() => {
  cart.items = [{ slug: "registro-esfera", name: "Registro de esfera", sku: "1234", quantity: 2 }];
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe.each(["pt", "en"] as const)("formulários com Turnstile (%s)", (locale) => {
  describe.each(FORMS)("$name", ({ render, pending }) => {
    it("sem site key no build: sem widget, sem aviso e botão de enviar liberado", () => {
      vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
      const html = renderToString(render(locale));

      expect(html).not.toContain(WIDGET_SLOT);
      expect(html).not.toContain(asHtml(pending(locale)));
      expect(submitButton(html)).not.toBe("");
      expect(submitButton(html)).not.toMatch(/\bdisabled\b/);
    });

    it("com site key: widget, aviso de verificação e botão desabilitado até o token", () => {
      vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", SITE_KEY);
      const html = renderToString(render(locale));

      expect(html).toContain(WIDGET_SLOT);
      expect(html).toContain(asHtml(pending(locale)));
      expect(submitButton(html)).toMatch(/\bdisabled\b/);
      expect(html.replace(/<style[\s\S]*?<\/style>/g, "")).not.toMatch(/undefined|\[object Object\]/);
    });
  });
});

describe("mensagens do Turnstile nos dicionários", () => {
  it.each(["pt", "en"] as const)("todas as telas têm as quatro mensagens em %s", (locale) => {
    const dictionary = DICTIONARIES[locale];
    const portal = dictionary.portal as unknown as PortalDictionary;
    const groups = [
      dictionary.contact.errors,
      dictionary.catalog.errors,
      dictionary.cart.errors,
      dictionary.representatives.errors,
      portal.account.errors,
      portal.login,
    ];
    for (const group of groups) {
      for (const key of ["captcha", "captchaUnavailable", "captchaPending", "captchaLoad"] as const) {
        expect(group[key]).toEqual(expect.any(String));
        expect(group[key].length).toBeGreaterThan(0);
      }
    }
  });
});
