"use client";

import Stack from "@mui/material/Stack";
import { CtaFields, FieldGroup, LocalizedField } from "./fields";
import { pairOf, type SectionEditorProps } from "./section-editor-props";

/** Chamada do Portal ROCO (convite ao pré-cadastro de representantes). */
export function PortalCtaEditor({
  form,
  onChange,
  defaults,
  errors,
  disabled,
  dictionary,
}: SectionEditorProps<"portalCta">) {
  const fields = dictionary.fields;
  const update = (patch: Partial<typeof form>) => onChange({ ...form, ...patch });

  return (
    <Stack spacing={4}>
      <FieldGroup title={fields.groupTexts}>
        <LocalizedField
          label={fields.headline}
          value={form.headline}
          onChange={(headline) => update({ headline })}
          defaults={pairOf((locale) => defaults[locale].portalCta.headline)}
          maxLength={120}
          errors={errors}
          errorPath="headline"
          disabled={disabled}
          dictionary={fields}
        />
        <LocalizedField
          label={fields.description}
          value={form.description}
          onChange={(description) => update({ description })}
          defaults={pairOf((locale) => defaults[locale].portalCta.description)}
          maxLength={400}
          errors={errors}
          errorPath="description"
          disabled={disabled}
          dictionary={fields}
          multiline
          minRows={3}
        />
      </FieldGroup>

      <FieldGroup title={fields.groupButton}>
        <CtaFields
          ctaLabel={form.ctaLabel}
          ctaHref={form.ctaHref}
          onChange={update}
          defaults={{
            label: pairOf((locale) => defaults[locale].portalCta.ctaLabel),
            href: defaults.pt.portalCta.ctaHref,
          }}
          errors={errors}
          disabled={disabled}
          dictionary={fields}
        />
      </FieldGroup>
    </Stack>
  );
}
