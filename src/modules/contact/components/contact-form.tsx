"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/core/lib/utils";
import { formatCNPJ, isValidCNPJ } from "@/shared/components/contact-form/cnpj";
import { formatPhoneBR, isValidPhoneBR } from "@/shared/lib/phone";
import { CONTACT_SUBJECTS } from "@/server/lib/contact-submit";
import type { ContactDictionary } from "@/modules/contact/lib/types";
import type { Locale } from "@/i18n/config";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ContactSubject = (typeof CONTACT_SUBJECTS)[number];

type TextFieldName = "name" | "email" | "phone" | "companyName" | "cnpj" | "message";
type FieldName = TextFieldName | "subject";

type FormState = Record<TextFieldName, string> & { subject: ContactSubject };
type FormErrors = Partial<Record<FieldName, string>> & { consent?: string };

export type ContactProductContext = { slug: string; name: string; sku: string };

type ContactFormProps = {
  content: ContactDictionary;
  locale: Locale;
  /** Produto de origem, quando a pessoa chega pelo "Solicitar orçamento" de
   *  um produto (`?produto=slug`) — resolvido pelo Server Component
   *  (nome/SKU reais, nunca aceito cru do cliente). */
  productContext?: ContactProductContext | null;
  /** Assunto pré-selecionado (`?assunto=` resolvido pelo Server Component). */
  defaultSubject?: ContactSubject;
};

function emptyForm(defaultSubject: ContactSubject): FormState {
  return {
    name: "",
    email: "",
    phone: "",
    companyName: "",
    cnpj: "",
    subject: defaultSubject,
    message: "",
  };
}

/**
 * Formulário de contato público (`/{locale}/contato`) — destino do clique
 * de maior intenção comercial do site ("Solicite um orçamento" no detalhe
 * do produto, e dos itens de nav "Contato"/"Ligamos pra você"). Mesmo
 * padrão do pré-cadastro de representantes (`register-form.tsx`): honeypot
 * invisível, validação client-side que espelha o schema do servidor
 * (`contactSchema` em `@/server/lib/contact-submit`), bloqueio de submit
 * inválido antes de qualquer fetch.
 *
 * Diferenças daquele form: CNPJ é OPCIONAL aqui (o form atende pessoa
 * física também — só valida o dígito verificador se preenchido); o assunto
 * é um select com as 3 opções fixas do servidor (`CONTACT_SUBJECTS`, mesma
 * fonte usada pela validação — nunca duplicado à mão); e o produto de
 * origem aparece como um chip somente-leitura acima do assunto, nunca um
 * campo editável (o nome/SKU exibidos vieram do servidor, resolvidos pelo
 * slug — o cliente não pode inventar um nome de produto).
 */
export function ContactForm({ content, locale, productContext, defaultSubject }: ContactFormProps) {
  const [form, setForm] = useState<FormState>(() => emptyForm(defaultSubject ?? "general"));
  const [errors, setErrors] = useState<FormErrors>({});
  const [consent, setConsent] = useState(false);
  const [context, setContext] = useState<ContactProductContext | null>(productContext ?? null);
  const [phase, setPhase] = useState<"idle" | "sending" | "success">("idle");
  const [serverError, setServerError] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState("");

  const subjectLabels: Record<ContactSubject, string> = {
    call_back: content.form.subject.options.callBack,
    quote: content.form.subject.options.quote,
    general: content.form.subject.options.general,
  };

  function setField(name: TextFieldName) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      let value = event.target.value;
      if (name === "cnpj") value = formatCNPJ(value);
      if (name === "phone") value = formatPhoneBR(value);
      setForm((current) => ({ ...current, [name]: value }));
      setErrors((current) => ({ ...current, [name]: undefined }));
      setServerError(null);
    };
  }

  function handleSubjectChange(event: ChangeEvent<HTMLSelectElement>) {
    setForm((current) => ({ ...current, subject: event.target.value as ContactSubject }));
    setServerError(null);
  }

  function handleConsentChange(event: ChangeEvent<HTMLInputElement>) {
    setConsent(event.target.checked);
    setErrors((current) => ({ ...current, consent: undefined }));
  }

  function validate(): FormErrors {
    const found: FormErrors = {};
    const v = content.validation;

    if (!form.name.trim()) found.name = v.required;
    if (!form.email.trim()) found.email = v.required;
    else if (!EMAIL_PATTERN.test(form.email.trim())) found.email = v.invalidEmail;
    if (!form.phone.trim()) found.phone = v.required;
    else if (!isValidPhoneBR(form.phone)) found.phone = v.invalidPhone;
    if (form.cnpj.trim() && !isValidCNPJ(form.cnpj)) found.cnpj = v.invalidCnpj;
    if (!consent) found.consent = v.consentRequired;

    return found;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setPhase("sending");
    setServerError(null);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone,
          companyName: form.companyName.trim() || undefined,
          cnpj: form.cnpj.trim() || undefined,
          subject: form.subject,
          message: form.message.trim() || undefined,
          ...(context ? { productSlug: context.slug } : {}),
          locale,
          consent: true,
          website: honeypot,
        }),
      });

      if (response.ok) {
        setPhase("success");
        return;
      }

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      const messages: Record<string, string> = {
        rate_limited: content.errors.rateLimited,
      };
      setServerError(messages[body?.error ?? ""] ?? content.errors.generic);
      setPhase("idle");
    } catch {
      setServerError(content.errors.generic);
      setPhase("idle");
    }
  }

  if (phase === "success") {
    return (
      <div
        role="status"
        className="rounded-2xl border border-neon-cyan/40 bg-neon-cyan/10 p-6 text-center sm:p-8"
      >
        <CheckCircle2 className="mx-auto mb-3 size-10 text-neon-cyan-bright" aria-hidden />
        <h2 className="font-display text-h2 text-white">{content.success.title}</h2>
        <p className="mt-2 text-meta text-white/80">{content.success.message}</p>
      </div>
    );
  }

  const fieldClass = "block";
  const errorClass = "mt-1 block text-micro text-[#ff9b9b]";

  function fieldProps(name: TextFieldName) {
    return {
      value: form[name],
      onChange: setField(name),
      "aria-invalid": errors[name] ? true : undefined,
      "aria-describedby": errors[name] ? `${name}-error` : undefined,
    };
  }

  function fieldError(name: keyof FormErrors) {
    return errors[name] ? (
      <span id={`${name}-error`} role="alert" className={errorClass}>
        {errors[name]}
      </span>
    ) : null;
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="form-neon relative rounded-2xl border border-white/10 bg-[#05070b]/70 p-4 shadow-[0_0_60px_rgba(53,217,255,0.10)] backdrop-blur-md sm:p-6"
    >
      <h2 className="mb-4 text-center font-display text-h2 text-white">{content.form.title}</h2>

      {/* Honeypot anti-bot: fora do fluxo visual e da ordem de tabulação. */}
      <div aria-hidden className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
        <label htmlFor="contact-website">Website</label>
        <input
          id="contact-website"
          name="website"
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

        <label className={fieldClass}>
          {content.form.companyName}
          <input type="text" autoComplete="organization" {...fieldProps("companyName")} />
          {fieldError("companyName")}
        </label>

        <label className={fieldClass}>
          {content.form.cnpj}
          <input type="text" inputMode="text" placeholder="00.000.000/0000-00" {...fieldProps("cnpj")} />
          {fieldError("cnpj")}
        </label>

        {context ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-neon-cyan/30 bg-neon-cyan/10 px-4 py-3 sm:col-span-2">
            <div className="min-w-0">
              <p className="text-micro font-semibold uppercase tracking-wide text-neon-cyan-bright">
                {content.form.productContext.label}
              </p>
              <p className="truncate text-meta text-white/90">{context.name}</p>
            </div>
            <button
              type="button"
              onClick={() => setContext(null)}
              className="shrink-0 rounded-full border border-white/20 px-3 py-1 text-micro text-white/70 transition hover:border-white/40 hover:text-white"
            >
              {content.form.productContext.clear}
            </button>
          </div>
        ) : null}

        <label className={cn(fieldClass, "sm:col-span-2")}>
          {content.form.subject.label}
          <select value={form.subject} onChange={handleSubjectChange}>
            {CONTACT_SUBJECTS.map((subject) => (
              <option key={subject} value={subject}>
                {subjectLabels[subject]}
              </option>
            ))}
          </select>
        </label>

        <label className={cn(fieldClass, "sm:col-span-2")}>
          {content.form.message}
          <textarea rows={4} {...fieldProps("message")} />
          {fieldError("message")}
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
          aria-describedby={errors.consent ? "consent-error" : undefined}
        />
        <span>{content.form.consent}</span>
      </label>
      {fieldError("consent")}

      {serverError ? (
        <p role="alert" className="mt-3 rounded-xl border border-[#ff6b6b]/40 bg-[#ff6b6b]/10 p-3 text-meta text-[#ffc2c2]">
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
  );
}
