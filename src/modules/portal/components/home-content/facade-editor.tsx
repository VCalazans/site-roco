"use client";

import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import { DEFAULT_FACADE_IMAGE } from "@/modules/home/lib/home-content";
import { CtaFields, FieldGroup, LocalizedField, SwitchField } from "./fields";
import { ImageField } from "./image-field";
import { pairOf, type SectionEditorProps } from "./section-editor-props";

/** Fachada: imagem + eyebrow/título/texto + botão opcional (RF17). */
export function FacadeEditor({
  form,
  onChange,
  defaults,
  errors,
  disabled,
  readOnly,
  dictionary,
  imageUrls,
  onImageUrl,
  ctaTargetHidden = false,
}: SectionEditorProps<"facade"> & {
  /**
   * O link do botão (o salvo ou o padrão `#sobre`) é a âncora de uma seção
   * oculta no layout atual — o site não mostra o botão (`targetsHiddenSection`),
   * então o editor avisa em vez de deixar o operador achando que é um erro.
   */
  ctaTargetHidden?: boolean;
}) {
  const fields = dictionary.fields;
  const update = (patch: Partial<typeof form>) => onChange({ ...form, ...patch });

  return (
    <Stack spacing={4}>
      <FieldGroup title={fields.groupImage}>
        <ImageField
          dictionary={dictionary.image}
          imageKey={form.imageKey}
          defaultPath={DEFAULT_FACADE_IMAGE}
          imageUrls={imageUrls}
          onChange={(imageKey) => update({ imageKey })}
          onImageUrl={onImageUrl}
          disabled={disabled}
          readOnly={readOnly}
          helper={dictionary.facade.imageHelper}
          error={errors.imageKey}
        />
        <LocalizedField
          label={fields.imageAlt}
          value={form.imageAlt}
          onChange={(imageAlt) => update({ imageAlt })}
          defaults={pairOf((locale) => defaults[locale].facade.imageAlt)}
          maxLength={200}
          errors={errors}
          errorPath="imageAlt"
          disabled={disabled}
          dictionary={fields}
          helper={fields.imageAltHelper}
        />
      </FieldGroup>

      <FieldGroup title={fields.groupTexts}>
        <LocalizedField
          label={fields.eyebrow}
          value={form.eyebrow}
          onChange={(eyebrow) => update({ eyebrow })}
          defaults={pairOf((locale) => defaults[locale].facade.eyebrow)}
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
          defaults={pairOf((locale) => defaults[locale].facade.headline)}
          maxLength={120}
          errors={errors}
          errorPath="headline"
          disabled={disabled}
          dictionary={fields}
        />
        <LocalizedField
          label={fields.text}
          value={form.text}
          onChange={(text) => update({ text })}
          defaults={pairOf((locale) => defaults[locale].facade.text)}
          maxLength={400}
          errors={errors}
          errorPath="text"
          disabled={disabled}
          dictionary={fields}
          multiline
          minRows={3}
        />
      </FieldGroup>

      <FieldGroup title={fields.groupButton}>
        <SwitchField
          label={fields.showCta}
          helper={dictionary.facade.showCtaHelper}
          checked={form.showCta}
          onChange={(showCta) => update({ showCta })}
          disabled={disabled}
        />
        {form.showCta && ctaTargetHidden ? (
          <Alert severity="warning" variant="outlined">
            {dictionary.facade.ctaTargetHidden}
          </Alert>
        ) : null}
        {form.showCta ? (
          <CtaFields
            ctaLabel={form.ctaLabel}
            ctaHref={form.ctaHref}
            onChange={update}
            defaults={{
              label: pairOf((locale) => defaults[locale].facade.ctaLabel),
              href: defaults.pt.facade.ctaHref,
            }}
            errors={errors}
            disabled={disabled}
            dictionary={fields}
          />
        ) : null}
      </FieldGroup>
    </Stack>
  );
}
