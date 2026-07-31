"use client";

import { useRef } from "react";
import { CheckCircle2, Download } from "lucide-react";
import {
  MAUTIC_FORM_ALIAS,
  MauticEmbed,
  type EnhancementCopy,
  type MauticFormCopy,
} from "@/shared/components/contact-form";
import { useCatalogDownload } from "@/modules/catalog/lib/use-catalog-download";

export type CatalogFormContent = {
  /** "Preencha os dados para receber o catálogo" */
  title: string;
  /** LGPD notice shown under the form, as in the design. */
  privacyNotice: string;
  privacyLabel: string;
  /** Panel shown once Mautic confirms the submission. */
  success: { title: string; description: string; action: string };
  /** Mautic labels/errors — reuses the contact dictionary, with its own submit. */
  form: MauticFormCopy;
  enhancement: EnhancementCopy;
};

type CatalogFormProps = {
  content: CatalogFormContent;
  /** Same-origin PDF served from /public and its suggested filename. */
  pdfUrl: string;
  pdfFileName: string;
  /** Optional privacy policy URL; without it the label renders as plain text. */
  privacyUrl?: string;
};

/**
 * The lead-gate on the catalog page: the same Mautic form used everywhere else
 * on the site (alias `formulariodosite`), embedded inline instead of in a modal,
 * wired so a successful submission downloads the catalog PDF without leaving the
 * page (see `useCatalogDownload`).
 *
 * Only one embed of this form may exist per page — the contact modal therefore
 * mounts its copy lazily and this page offers no trigger for it (its contact nav
 * links point at this form's anchor instead).
 */
export function CatalogForm({
  content,
  pdfUrl,
  pdfFileName,
  privacyUrl,
}: CatalogFormProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { succeeded, download } = useCatalogDownload({
    formAlias: MAUTIC_FORM_ALIAS,
    fileUrl: pdfUrl,
    fileName: pdfFileName,
    containerRef,
  });

  return (
    <div className="rounded-3xl border border-white/10 bg-[#05070b]/75 p-6 shadow-[0_0_60px_rgba(53,217,255,0.10)] backdrop-blur-md sm:p-8">
      <h2 className="mb-5 text-center font-display text-xl font-bold leading-snug text-white sm:text-2xl">
        {content.title}
      </h2>

      {succeeded && (
        <div
          role="status"
          className="mb-5 rounded-2xl border border-neon-cyan/40 bg-neon-cyan/10 p-4 text-center"
        >
          <CheckCircle2
            className="mx-auto mb-2 size-7 text-neon-cyan-bright"
            aria-hidden
          />
          <p className="font-display text-base font-semibold text-white">
            {content.success.title}
          </p>
          <p className="mt-1 text-sm text-white/75">
            {content.success.description}
          </p>
          <button
            type="button"
            onClick={download}
            className="btn-neon mt-4 w-full text-sm"
          >
            <Download className="size-4" aria-hidden />
            {content.success.action}
          </button>
        </div>
      )}

      <MauticEmbed
        active
        containerRef={containerRef}
        content={content.form}
        enhancement={content.enhancement}
      />

      <p className="mt-4 text-xs leading-relaxed text-white/55">
        {content.privacyNotice}{" "}
        {privacyUrl ? (
          <a
            href={privacyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 transition hover:text-white"
          >
            {content.privacyLabel}
          </a>
        ) : (
          <span className="text-white/70">{content.privacyLabel}</span>
        )}
        .
      </p>
    </div>
  );
}
