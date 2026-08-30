"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/core/lib/utils";
import {
  CATALOG_COMPANY_MAX,
  CATALOG_EMAIL_MAX,
  CATALOG_NAME_MAX,
  CATALOG_PHONE_MAX,
  CATALOG_SUBJECT,
  catalogDownloadLink,
  catalogServerFieldErrors,
  hasCatalogFormErrors,
  validateCatalogForm,
  type CatalogFieldName,
  type CatalogFormErrors,
  type CatalogFormValues,
} from "@/modules/catalog/lib/catalog-form";
import type { CatalogDictionary } from "@/modules/catalog/lib/types";
import { HONEYPOT_FIELD } from "@/server/lib/contact-submit";
import { formatPhoneBR } from "@/shared/lib/phone";
import type { LeadOrigin } from "@/shared/lib/lead-origin";
import type { Locale } from "@/i18n/config";

/** Campanha externa (`utm_*`) lida da URL pelo Server Component. */
export type CatalogUtm = { source?: string; medium?: string; campaign?: string };

type CatalogFormProps = {
  content: CatalogDictionary;
  locale: Locale;
  /** URL do PDF resolvida no servidor (`getCatalogPdfUrl`: banco → env → constante). */
  pdfUrl: string;
  /** Seção do site que originou o clique, já resolvida (`resolveCatalogOrigin`). */
  origin: LeadOrigin;
  /** Campanha externa (`?utm_*=`), já sanitizada pelo Server Component. */
  utm?: CatalogUtm;
  /** Política de privacidade (`NEXT_PUBLIC_PRIVACY_URL`); vazia = texto sem link. */
  privacyHref?: string;
};

const EMPTY_FORM: CatalogFormValues = {
  name: "",
  email: "",
  phone: "",
  companyName: "",
};

/**
 * Formulário que devolve a captura de lead à landing do catálogo.
 *
 * A página distribui um material comercial de valor: desde que o Mautic saiu
 * (2026-08-23) ela virou download direto e deixou de capturar qualquer lead —
 * o próprio comentário em `core/config/site.ts` ainda descrevia o gate que
 * não existia mais. Aqui o PDF volta a ficar atrás dos dados.
 *
 * Reaproveita `POST /api/contact` com `subject: "catalog"` em vez de ter rota
 * própria: rate limit, honeypot, gravação em `contact_submissions` e os dois
 * canais de saída (RD Station, e-mail) já estão lá, e duplicá-los criaria uma
 * segunda superfície pública para manter em dia. No RD Station o assunto vira
 * o `conversion_identifier` `download_catalogo`, então o funil separa esta
 * intenção das outras três sem nenhum campo extra.
 *
 * Tailwind puro (`.form-neon`), como todo o route group `(site)`: MUI aqui já
 * derrubou esta página inteira com HTTP 500 — ver o comentário em `page.tsx`.
 */
export function CatalogForm({
  content,
  locale,
  pdfUrl,
  origin,
  utm,
  privacyHref,
}: CatalogFormProps) {
  const [form, setForm] = useState<CatalogFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<CatalogFormErrors>({});
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState<"idle" | "sending" | "success">("idle");
  const [serverError, setServerError] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState("");

  const downloadLink = catalogDownloadLink(pdfUrl);

  function setField(name: CatalogFieldName) {
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

  /**
   * Dispara o download assim que o lead é aceito. É best-effort de propósito:
   * o navegador pode recusar um download que não parte de um clique direto
   * (a ativação transitória do gesto original pode ter expirado durante o
   * await), e nenhum erro aqui pode manchar um envio que deu certo — por isso
   * o painel de sucesso mantém o link visível, que é o caminho garantido.
   */
  function triggerDownload() {
    if (typeof document === "undefined" || !downloadLink.href) return;
    try {
      const anchor = document.createElement("a");
      anchor.href = downloadLink.href;
      if (downloadLink.download) anchor.download = downloadLink.download;
      if (downloadLink.target) anchor.target = downloadLink.target;
      if (downloadLink.rel) anchor.rel = downloadLink.rel;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } catch {
      // Silencioso: o link de fallback do painel de sucesso cobre o caso.
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validateCatalogForm(form, consent);
    setErrors(found);
    if (hasCatalogFormErrors(found)) return;

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
          subject: CATALOG_SUBJECT,
          // Rastreio de aquisição: o servidor revalida os dois (origem contra
          // a lista fechada, UTM saneada) — aqui é só transporte.
          origin,
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
        triggerDownload();
        return;
      }

      const body = (await response.json().catch(() => null)) as
        | { error?: string; fields?: unknown }
        | null;

      if (body?.error === "validation") {
        // O servidor diz QUAL campo reprovou — destacar o campo (com
        // `aria-invalid` + `aria-describedby`, que `fieldProps`/`fieldError`
        // já derivam deste estado) vale muito mais que um banner genérico.
        const flagged = catalogServerFieldErrors(body.fields);
        setErrors(flagged);
        // Banner só quando o servidor reprovou algo que este formulário nem
        // renderiza — senão a pessoa ficaria sem nenhuma pista.
        setServerError(hasCatalogFormErrors(flagged) ? null : content.errors.validation);
        setPhase("idle");
        return;
      }

      const messages: Record<string, string> = {
        rate_limited: content.errors.rateLimited,
        // 503 do rate limiter fail-closed (Redis fora): não é repetição da
        // pessoa, e chamá-la de repetitiva na primeira tentativa manda o
        // suporte investigar a coisa errada.
        unavailable: content.errors.unavailable,
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
        <p className="mt-2 text-meta text-white/80">{content.success.description}</p>
        {/* Link visível, não enfeite: quando o navegador bloqueia o download
            automático (ou o PDF vive em outro domínio), este é o caminho. */}
        <a {...downloadLink} className="btn-neon mt-5 inline-flex">
          {content.success.action}
        </a>
      </div>
    );
  }

  const fieldClass = "block";
  const errorClass = "mt-1 block text-micro text-[#ff9b9b]";

  function errorMessage(name: CatalogFieldName | "consent"): string | undefined {
    const code = errors[name];
    return code ? content.validation[code] : undefined;
  }

  function fieldProps(name: CatalogFieldName) {
    return {
      value: form[name],
      onChange: setField(name),
      "aria-invalid": errors[name] ? true : undefined,
      "aria-describedby": errors[name] ? `catalog-${name}-error` : undefined,
    };
  }

  function fieldError(name: CatalogFieldName | "consent") {
    const message = errorMessage(name);
    return message ? (
      <span id={`catalog-${name}-error`} role="alert" className={errorClass}>
        {message}
      </span>
    ) : null;
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="form-neon relative rounded-2xl border border-white/10 bg-[#05070b]/70 p-4 shadow-[0_0_60px_rgba(53,217,255,0.10)] backdrop-blur-md sm:p-6"
    >
      <h2 className="mb-4 text-center font-display text-h2 text-white">{content.formTitle}</h2>

      {/* Honeypot anti-bot: fora do fluxo visual e da ordem de tabulação. */}
      <div aria-hidden className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
        <label htmlFor="catalog-website">Website</label>
        <input
          id="catalog-website"
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
          {content.fields.name}
          <input
            type="text"
            autoComplete="name"
            maxLength={CATALOG_NAME_MAX}
            required
            {...fieldProps("name")}
          />
          {fieldError("name")}
        </label>

        <label className={fieldClass}>
          {content.fields.email}
          <input
            type="email"
            autoComplete="email"
            maxLength={CATALOG_EMAIL_MAX}
            required
            {...fieldProps("email")}
          />
          {fieldError("email")}
        </label>

        <label className={fieldClass}>
          {content.fields.phone}
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="(00) 00000-0000"
            maxLength={CATALOG_PHONE_MAX}
            required
            {...fieldProps("phone")}
          />
          {fieldError("phone")}
        </label>

        <label className={cn(fieldClass, "sm:col-span-2")}>
          {content.fields.companyName}
          <input
            type="text"
            autoComplete="organization"
            maxLength={CATALOG_COMPANY_MAX}
            {...fieldProps("companyName")}
          />
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
          aria-describedby={errors.consent ? "catalog-consent-error" : undefined}
        />
        <span>{content.consent}</span>
      </label>
      {fieldError("consent")}

      {serverError ? (
        <div
          role="alert"
          className="mt-3 rounded-xl border border-[#ff6b6b]/40 bg-[#ff6b6b]/10 p-3 text-meta text-[#ffc2c2]"
        >
          <p>{serverError}</p>
          {/* Falha NOSSA (Redis fora, 5xx, rede) não pode confiscar um
              material que é público de qualquer forma — o gate é de
              marketing, não de acesso (ver o comentário em `page.tsx`).
              Perde-se o lead; nunca o download. Antes de esta página voltar a
              ter formulário, um incidente de infra não afetava o catálogo em
              nada — este link restaura essa garantia. */}
          {downloadLink.href ? (
            <a {...downloadLink} className="btn-neon mt-3 inline-flex">
              {content.success.action}
            </a>
          ) : null}
        </div>
      ) : null}

      <button type="submit" disabled={phase === "sending"} className="btn-neon mt-4 w-full">
        {phase === "sending" ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {content.sending}
          </>
        ) : (
          content.submit
        )}
      </button>

      <p className="mt-3 text-micro text-white/55">
        {content.privacyNotice}{" "}
        {privacyHref ? (
          <a
            href={privacyHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-neon-cyan-bright underline underline-offset-2 transition hover:opacity-90"
          >
            {content.privacyLabel}
          </a>
        ) : (
          content.privacyLabel
        )}
        .
      </p>
    </form>
  );
}
