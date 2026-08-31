"use client";

import { useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { cn } from "@/core/lib/utils";
import { productsPath, siteLinks } from "@/core/config/site";
import { contactSchema, HONEYPOT_FIELD, MAX_CART_ITEM_QUANTITY } from "@/server/lib/contact-submit";
import { formatPhoneBR, isValidPhoneBR } from "@/shared/lib/phone";
import {
  clearCart,
  removeItem,
  setQuantity,
  useCartItems,
} from "@/shared/lib/cart-store";
import { buildWhatsappCartMessage } from "@/modules/cart/lib/cart-whatsapp";
import type { CartDictionary } from "@/modules/cart/lib/types";
import type { Locale } from "@/i18n/config";

/** O PRÓPRIO campo do schema do servidor, não um regex paralelo — mesma
 *  razão de `ContactForm`/`CatalogForm` (`contactSchema.shape.email`). */
const emailField = contactSchema.shape.email;

/** Campanha externa (`utm_*`), já resolvida/sanitizada pelo Server Component. */
export type CartUtm = { source?: string; medium?: string; campaign?: string };

type TextFieldName = "name" | "email" | "phone" | "companyName";
type FormState = Record<TextFieldName, string>;
type FormErrors = Partial<Record<TextFieldName, string>> & { consent?: string };

type CartPageViewProps = {
  content: CartDictionary;
  locale: Locale;
  /** Campanha externa (`?utm_*=` da própria página OU do cookie de primeira
   *  parte) — o servidor revalida de novo; aqui é só transporte, mesmo
   *  critério de `/contato` e `/catalogo`. */
  utm?: CartUtm;
};

const EMPTY_FORM: FormState = { name: "", email: "", phone: "", companyName: "" };

/**
 * Título FIXO da página — mesmo papel de `contact.headline`/`contact.subheadline`
 * em `/contato` (que ficam visíveis independente do estado do formulário).
 * Renderizado UMA vez pelos três estados possíveis (sucesso / vazio /
 * itens+formulário) em vez de repetido — ou pior, omitido — em cada um.
 */
function PageHeading({ content, children }: { content: CartDictionary; children: ReactNode }) {
  return (
    <div>
      <h1 className="text-glow-soft font-display text-h1 text-white">{content.page.headline}</h1>
      <p className="mt-3 max-w-2xl text-lede text-neon-cyan-bright">{content.page.subheadline}</p>
      <div className="mt-8">{children}</div>
    </div>
  );
}

/**
 * Carrinho de cotação — NÃO é e-commerce: sem preço, sem checkout. Junta
 * vários produtos numa solicitação só (`POST /api/contact`, `subject:
 * "cart"`), reaproveitando a mesma rota/canais (RD Station, e-mail,
 * `contact_submissions`) dos outros formulários públicos.
 *
 * O estado do carrinho é local (`@/shared/lib/cart-store`, `localStorage`) —
 * este componente só o lê/muta; a fonte de verdade para o ENVIO é sempre o
 * servidor, que re-resolve nome/SKU a partir do `slug` no submit.
 */
export function CartPageView({ content, locale, utm }: CartPageViewProps) {
  const items = useCartItems();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState<"idle" | "sending" | "success">("idle");
  const [serverError, setServerError] = useState<string | null>(null);
  const [cartEmptyError, setCartEmptyError] = useState(false);
  const [honeypot, setHoneypot] = useState("");

  function setField(name: TextFieldName) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value;
      const value = name === "phone" ? formatPhoneBR(raw) : raw;
      setForm((current) => ({ ...current, [name]: value }));
      setErrors((current) => ({ ...current, [name]: undefined }));
      setServerError(null);
    };
  }

  function handleConsentChange(event: ChangeEvent<HTMLInputElement>) {
    setConsent(event.target.checked);
    setErrors((current) => ({ ...current, consent: undefined }));
  }

  function handleClearCart() {
    if (typeof window !== "undefined" && !window.confirm(content.page.clearCartConfirm)) return;
    clearCart();
  }

  /** Traduz o array `fields` de um 400 em erros POR CAMPO — mesmo padrão de
   *  `ContactForm`/`CatalogForm`: sem isto qualquer reprovação do servidor
   *  virava um banner genérico de "tente novamente", sem marcar campo nenhum. */
  function serverFieldErrors(fields: unknown): FormErrors {
    if (!Array.isArray(fields)) return {};
    const v = content.validation;
    const map: Record<string, [keyof FormErrors, string]> = {
      name: ["name", v.invalid],
      email: ["email", v.invalidEmail],
      phone: ["phone", v.invalidPhone],
      companyName: ["companyName", v.invalid],
      consent: ["consent", v.consentRequired],
    };

    const found: FormErrors = {};
    for (const raw of fields) {
      if (typeof raw !== "string") continue;
      const mapped = map[raw];
      if (mapped) found[mapped[0]] = mapped[1];
    }
    return found;
  }

  function validate(): FormErrors {
    const found: FormErrors = {};
    const v = content.validation;

    if (!form.name.trim()) found.name = v.required;
    if (!form.email.trim()) found.email = v.required;
    else if (!emailField.safeParse(form.email.trim()).success) found.email = v.invalidEmail;
    if (!form.phone.trim()) found.phone = v.required;
    else if (!isValidPhoneBR(form.phone)) found.phone = v.invalidPhone;
    if (!consent) found.consent = v.consentRequired;

    return found;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (items.length === 0) return;

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setPhase("sending");
    setServerError(null);
    setCartEmptyError(false);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone,
          companyName: form.companyName.trim() || undefined,
          subject: "cart",
          items: items.map((item) => ({ slug: item.slug, quantity: item.quantity })),
          // Rastreio de campanha (UTM): o servidor grava `origin: "carrinho"`
          // sozinho para este assunto (ver `POST /api/contact`), então não
          // mandamos `origin` aqui — só a campanha externa, para não perder
          // atribuição de mídia paga quando o clique veio de um anúncio.
          ...(utm?.source ? { utmSource: utm.source } : {}),
          ...(utm?.medium ? { utmMedium: utm.medium } : {}),
          ...(utm?.campaign ? { utmCampaign: utm.campaign } : {}),
          locale,
          consent: true,
          [HONEYPOT_FIELD]: honeypot,
        }),
      });

      if (response.ok) {
        setPhase("success");
        // A unidade de trabalho terminou: sem isto a pessoa voltaria e veria
        // os mesmos itens "fantasma" depois de já ter enviado a solicitação.
        clearCart();
        return;
      }

      const body = (await response.json().catch(() => null)) as
        | { error?: string; fields?: unknown }
        | null;

      if (body?.error === "cart_empty") {
        // O servidor não achou NENHUM item — a lista local está obsoleta
        // (produtos removidos/despublicados desde que foram adicionados).
        setCartEmptyError(true);
        setPhase("idle");
        return;
      }

      if (body?.error === "validation") {
        const flagged = serverFieldErrors(body.fields);
        setErrors(flagged);
        setServerError(Object.keys(flagged).length > 0 ? null : content.errors.validation);
        setPhase("idle");
        return;
      }

      const messages: Record<string, string> = {
        rate_limited: content.errors.rateLimited,
        unavailable: content.errors.unavailable,
      };
      setServerError(messages[body?.error ?? ""] ?? content.errors.generic);
      setPhase("idle");
    } catch {
      setServerError(content.errors.generic);
      setPhase("idle");
    }
  }

  const whatsappHref =
    items.length > 0
      ? buildWhatsappCartMessage(
          items.map((item) => ({ name: item.name, sku: item.sku, quantity: item.quantity })),
          content.whatsapp.messageIntro,
          content.whatsapp.moreItemsSuffix,
          siteLinks.whatsapp
        )
      : null;

  // `page.headline`/`page.subheadline` funcionam como o título FIXO da
  // página (mesmo papel de `contact.headline`/`contact.subheadline` em
  // `/contato`, que ficam visíveis independente do formulário estar em
  // sucesso ou não) — por isso são renderizados UMA vez, fora dos três
  // estados abaixo (sucesso / vazio / itens+formulário), em vez de repetidos
  // (ou omitidos) em cada branch.
  if (phase === "success") {
    return (
      <PageHeading content={content}>
        <div
          role="status"
          className="mx-auto max-w-xl rounded-2xl border border-neon-cyan/40 bg-neon-cyan/10 p-6 text-center sm:p-8"
        >
          <CheckCircle2 className="mx-auto mb-3 size-10 text-neon-cyan-bright" aria-hidden />
          <h2 className="font-display text-h2 text-white">{content.success.title}</h2>
          <p className="mt-2 text-meta text-white/80">{content.success.message}</p>
          <Link href={productsPath(locale)} className="btn-neon mt-5 inline-flex">
            {content.page.emptyCta}
          </Link>
        </div>
      </PageHeading>
    );
  }

  if (items.length === 0) {
    return (
      <PageHeading content={content}>
        <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center sm:p-8">
          <h2 className="font-display text-h2 text-white">{content.page.emptyTitle}</h2>
          <p className="mt-3 text-body text-white/70">{content.page.emptyMessage}</p>
          <Link href={productsPath(locale)} className="btn-neon mt-6 inline-flex">
            {content.page.emptyCta}
          </Link>
        </div>
      </PageHeading>
    );
  }

  const fieldClass = "block";
  const errorClass = "mt-1 block text-micro text-[#ff9b9b]";

  function fieldProps(name: TextFieldName) {
    return {
      value: form[name],
      onChange: setField(name),
      "aria-invalid": errors[name] ? true : undefined,
      "aria-describedby": errors[name] ? `cart-${name}-error` : undefined,
    };
  }

  function fieldError(name: keyof FormErrors) {
    return errors[name] ? (
      <span id={`cart-${name}-error`} role="alert" className={errorClass}>
        {errors[name]}
      </span>
    ) : null;
  }

  return (
    <PageHeading content={content}>
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(21rem,29rem)]">
        {/* Itens selecionados */}
        <section
          aria-labelledby="cart-items-heading"
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-6"
        >
          <div className="flex items-center justify-between gap-4">
            <h2 id="cart-items-heading" className="font-display text-h2 text-white">
              {content.page.itemsHeading}
            </h2>
            <button
              type="button"
              onClick={handleClearCart}
              className="text-micro font-semibold text-white/60 underline-offset-2 transition hover:text-[#ff9b9b] hover:underline"
            >
              {content.page.clearCart}
            </button>
          </div>

          {cartEmptyError ? (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-neon-amber/40 bg-neon-amber/10 p-3 text-meta text-neon-amber-bright"
            >
              <p>{content.errors.cartEmpty}</p>
              {/* Sem confirmação aqui (ao contrário do botão acima): o
                  servidor já provou que a lista local está obsoleta — pedir
                  confirmação de novo só atrasaria a recuperação. */}
              <button type="button" onClick={() => clearCart()} className="btn-neon mt-3 inline-flex">
                {content.page.clearCart}
              </button>
            </div>
          ) : null}

          <ul className="mt-4 flex flex-col divide-y divide-white/10">
            {items.map((item) => (
              <li
                key={item.slug}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-ui font-semibold text-white">{item.name}</p>
                  <p className="text-micro text-white/50">
                    {content.page.skuLabel} {item.sku}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <div
                    role="group"
                    aria-label={content.page.quantityLabel}
                    className="flex items-center gap-1 rounded-full border border-white/15 bg-white/5"
                  >
                    <button
                      type="button"
                      aria-label={`${content.page.quantityLabel} -1`}
                      disabled={item.quantity <= 1}
                      onClick={() => setQuantity(item.slug, item.quantity - 1)}
                      className="flex size-8 items-center justify-center text-white/80 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Minus className="size-3.5" aria-hidden />
                    </button>
                    <span aria-live="polite" className="w-8 text-center text-meta text-white">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      aria-label={`${content.page.quantityLabel} +1`}
                      disabled={item.quantity >= MAX_CART_ITEM_QUANTITY}
                      onClick={() => setQuantity(item.slug, item.quantity + 1)}
                      className="flex size-8 items-center justify-center text-white/80 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Plus className="size-3.5" aria-hidden />
                    </button>
                  </div>

                  <button
                    type="button"
                    aria-label={content.page.removeItem}
                    title={content.page.removeItem}
                    onClick={() => removeItem(item.slug)}
                    className="flex size-8 items-center justify-center rounded-full text-white/50 transition hover:bg-[#ff6b6b]/10 hover:text-[#ff9b9b]"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {whatsappHref ? (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-neon btn-neon--amber mt-6 w-full justify-center sm:w-auto"
            >
              {content.whatsapp.buttonLabel}
            </a>
          ) : null}
        </section>

        {/* Formulário de envio */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="form-neon relative rounded-2xl border border-white/10 bg-[#05070b]/70 p-4 shadow-[0_0_60px_rgba(53,217,255,0.10)] backdrop-blur-md sm:p-6"
        >
          <h2 className="mb-4 text-center font-display text-h2 text-white">{content.form.title}</h2>

          {/* Honeypot anti-bot: fora do fluxo visual e da ordem de tabulação. */}
          <div aria-hidden className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
            <label htmlFor="cart-website">Website</label>
            <input
              id="cart-website"
              name={HONEYPOT_FIELD}
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(event) => setHoneypot(event.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={cn(fieldClass, "sm:col-span-2")}>
              {content.form.name}
              <input type="text" autoComplete="name" required {...fieldProps("name")} />
              {fieldError("name")}
            </label>

            <label className={fieldClass}>
              {content.form.email}
              <input type="email" autoComplete="email" required {...fieldProps("email")} />
              {fieldError("email")}
            </label>

            <label className={fieldClass}>
              {content.form.phone}
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="(00) 00000-0000"
                required
                {...fieldProps("phone")}
              />
              {fieldError("phone")}
            </label>

            <label className={cn(fieldClass, "sm:col-span-2")}>
              {content.form.companyName}
              <input type="text" autoComplete="organization" {...fieldProps("companyName")} />
              {fieldError("companyName")}
            </label>
          </div>

          <label className="mt-3 flex items-start gap-2.5 text-micro text-white/70">
            <input
              type="checkbox"
              checked={consent}
              onChange={handleConsentChange}
              required
              className="mt-0.5 size-4 shrink-0 rounded border-white/30 bg-white/5 accent-neon-cyan-bright"
              aria-invalid={errors.consent ? true : undefined}
              aria-describedby={errors.consent ? "cart-consent-error" : undefined}
            />
            <span>{content.form.consent}</span>
          </label>
          {fieldError("consent")}

          {serverError ? (
            <p
              role="alert"
              className="mt-3 rounded-xl border border-[#ff6b6b]/40 bg-[#ff6b6b]/10 p-3 text-meta text-[#ffc2c2]"
            >
              {serverError}
            </p>
          ) : null}

          <button type="submit" disabled={phase === "sending"} className="btn-neon mt-4 w-full">
            {phase === "sending" ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {content.form.sending}
              </>
            ) : (
              content.form.submit
            )}
          </button>
        </form>
      </div>
    </PageHeading>
  );
}
