"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/core/lib/utils";
import { formatCNPJ, isValidCNPJ } from "@/shared/components/contact-form/cnpj";
import { formatPhoneBR, isValidPhoneBR } from "@/shared/lib/phone";
import type { RepresentativesDictionary } from "@/modules/representatives/lib/types";

const PASSWORD_MIN = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldName =
  | "name"
  | "email"
  | "phone"
  | "companyName"
  | "cnpj"
  | "password"
  | "passwordConfirm";

type FormState = Record<FieldName, string>;
type FormErrors = Partial<Record<FieldName, string>>;

const EMPTY_FORM: FormState = {
  name: "",
  email: "",
  phone: "",
  companyName: "",
  cnpj: "",
  password: "",
  passwordConfirm: "",
};

type RegisterFormProps = {
  content: RepresentativesDictionary;
  /** `/{locale}/portal/login` — CTA do painel de sucesso e do rodapé. */
  loginHref: string;
};

/**
 * Formulário de pré-cadastro do representante (canal público do site).
 * Validação client-side espelha o `registerSchema` do servidor (CNPJ
 * obrigatório/válido, telefone BR, senha mínima) — o servidor revalida tudo.
 * O campo `website` é honeypot anti-bot (invisível; humano nunca preenche).
 */
export function RegisterForm({ content, loginHref }: RegisterFormProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [phase, setPhase] = useState<"idle" | "sending" | "success">("idle");
  const [serverError, setServerError] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState("");

  function setField(name: FieldName) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      let value = event.target.value;
      if (name === "cnpj") value = formatCNPJ(value);
      if (name === "phone") value = formatPhoneBR(value);
      setForm((current) => ({ ...current, [name]: value }));
      setErrors((current) => ({ ...current, [name]: undefined }));
      setServerError(null);
    };
  }

  function validate(): FormErrors {
    const found: FormErrors = {};
    const v = content.validation;

    if (!form.name.trim()) found.name = v.required;
    if (!form.email.trim()) found.email = v.required;
    else if (!EMAIL_PATTERN.test(form.email.trim())) found.email = v.invalidEmail;
    if (!form.phone.trim()) found.phone = v.required;
    else if (!isValidPhoneBR(form.phone)) found.phone = v.invalidPhone;
    if (!form.companyName.trim()) found.companyName = v.required;
    if (!form.cnpj.trim()) found.cnpj = v.required;
    else if (!isValidCNPJ(form.cnpj)) found.cnpj = v.invalidCnpj;
    if (!form.password) found.password = v.required;
    else if (form.password.length < PASSWORD_MIN) found.password = v.passwordTooShort;
    if (form.passwordConfirm !== form.password) found.passwordConfirm = v.passwordMismatch;

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
      const response = await fetch("/api/representatives/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone,
          companyName: form.companyName.trim(),
          cnpj: form.cnpj,
          password: form.password,
          website: honeypot,
        }),
      });

      if (response.ok) {
        setPhase("success");
        return;
      }

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      const messages: Record<string, string> = {
        email_exists: content.errors.emailExists,
        cnpj_exists: content.errors.cnpjExists,
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
        <a href={loginHref} className="btn-neon mt-5 inline-flex">
          {content.success.loginCta}
        </a>
      </div>
    );
  }

  const fieldClass = "block";
  const errorClass = "mt-1 block text-micro text-[#ff9b9b]";

  function fieldProps(name: FieldName) {
    return {
      value: form[name],
      onChange: setField(name),
      "aria-invalid": errors[name] ? true : undefined,
      "aria-describedby": errors[name] ? `${name}-error` : undefined,
    };
  }

  function fieldError(name: FieldName) {
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
      <h2 className="mb-4 text-center font-display text-h2 text-white">
        {content.form.title}
      </h2>

      {/* Honeypot anti-bot: fora do fluxo visual e da ordem de tabulação. */}
      <div aria-hidden className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
        <label htmlFor="register-website">Website</label>
        <input
          id="register-website"
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
          <input type="text" autoComplete="organization" required {...fieldProps("companyName")} />
          {fieldError("companyName")}
        </label>

        <label className={fieldClass}>
          {content.form.cnpj}
          <input
            type="text"
            inputMode="text"
            placeholder="00.000.000/0000-00"
            required
            {...fieldProps("cnpj")}
          />
          {fieldError("cnpj")}
        </label>

        <label className={fieldClass}>
          {content.form.password}
          <input
            type="password"
            autoComplete="new-password"
            minLength={PASSWORD_MIN}
            required
            {...fieldProps("password")}
          />
          {fieldError("password")}
        </label>

        <label className={fieldClass}>
          {content.form.passwordConfirm}
          <input
            type="password"
            autoComplete="new-password"
            minLength={PASSWORD_MIN}
            required
            {...fieldProps("passwordConfirm")}
          />
          {fieldError("passwordConfirm")}
        </label>
      </div>

      <p className="mt-2 text-micro text-white/55">{content.form.passwordHint}</p>

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

      <p className="mt-3 text-micro text-white/55">{content.lgpd}</p>

      <p className="mt-3 text-center text-meta text-white/70">
        {content.loginPrompt}{" "}
        <a href={loginHref} className="text-neon-cyan-bright underline underline-offset-2 transition hover:opacity-90">
          {content.loginLink}
        </a>
      </p>
    </form>
  );
}
