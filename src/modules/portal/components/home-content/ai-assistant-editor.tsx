"use client";

import Stack from "@mui/material/Stack";
import { CtaFields, FieldGroup, LocalizedField } from "./fields";
import { pairOf, type SectionEditorProps } from "./section-editor-props";

/**
 * Chamada "ROCO na sua IA" (spec 003): convite para conectar o catálogo ao
 * Claude/ChatGPT. Os três passos e o botão "Conectar ao Claude" são fixos (o
 * link de instalação é técnico); textos e o botão "Ver como funciona" são editáveis.
 */
export function AiAssistantEditor({
  form,
  onChange,
  defaults,
  errors,
  disabled,
  dictionary,
}: SectionEditorProps<"aiAssistant">) {
  const fields = dictionary.fields;
  const update = (patch: Partial<typeof form>) => onChange({ ...form, ...patch });

  return (
    <Stack spacing={4}>
      <FieldGroup title={fields.groupTexts}>
        <LocalizedField
          label={fields.eyebrow}
          value={form.eyebrow}
          onChange={(eyebrow) => update({ eyebrow })}
          defaults={pairOf((locale) => defaults[locale].aiAssistant.eyebrow)}
          maxLength={80}
          errors={errors}
          errorPath="eyebrow"
          disabled={disabled}
          dictionary={fields}
        />
        <LocalizedField
          label={fields.headline}
          value={form.headline}
          onChange={(headline) => update({ headline })}
          defaults={pairOf((locale) => defaults[locale].aiAssistant.headline)}
          maxLength={160}
          errors={errors}
          errorPath="headline"
          disabled={disabled}
          dictionary={fields}
        />
        <LocalizedField
          label={fields.description}
          value={form.description}
          onChange={(description) => update({ description })}
          defaults={pairOf((locale) => defaults[locale].aiAssistant.description)}
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
            label: pairOf((locale) => defaults[locale].aiAssistant.ctaLabel),
            href: defaults.pt.aiAssistant.ctaHref,
          }}
          errors={errors}
          disabled={disabled}
          dictionary={fields}
        />
      </FieldGroup>
    </Stack>
  );
}
