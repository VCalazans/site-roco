"use client";

import Box from "@mui/material/Box";
import FormHelperText from "@mui/material/FormHelperText";
import Slider from "@mui/material/Slider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { interpolate } from "@/shared/lib/interpolate";
import { CtaFields, FieldGroup, LocalizedField } from "./fields";
import { FeaturedProductsManager } from "./featured-products-manager";
import { HOME_FEATURED_LIMIT } from "./home-editor-model";
import { pairOf, type SectionEditorProps } from "./section-editor-props";

type FeaturedEditorProps = SectionEditorProps<"featured"> & {
  /** `products:read` — ver a lista de produtos da vitrine. */
  canReadProducts: boolean;
  /** `products:update` — adicionar, remover e reordenar produtos da vitrine. */
  canManageProducts: boolean;
  onNotify: (severity: "success" | "error", message: string) => void;
};

const LIMIT_LABEL_ID = "home-featured-limit-label";

/** Produtos em destaque: textos + limite (documento) e a lista de produtos (gravada na hora). */
export function FeaturedEditor({
  form,
  onChange,
  locale,
  defaults,
  errors,
  disabled,
  dictionary,
  canReadProducts,
  canManageProducts,
  onNotify,
}: FeaturedEditorProps) {
  const fields = dictionary.fields;
  const copy = dictionary.featured;
  const update = (patch: Partial<typeof form>) => onChange({ ...form, ...patch });

  return (
    <Stack spacing={4}>
      <FieldGroup title={fields.groupTexts}>
        <LocalizedField
          label={fields.eyebrow}
          value={form.eyebrow}
          onChange={(eyebrow) => update({ eyebrow })}
          defaults={pairOf((l) => defaults[l].featured.eyebrow)}
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
          defaults={pairOf((l) => defaults[l].featured.headline)}
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
          defaults={pairOf((l) => defaults[l].featured.description)}
          maxLength={400}
          errors={errors}
          errorPath="description"
          disabled={disabled}
          dictionary={fields}
          multiline
          minRows={3}
        />
        <LocalizedField
          label={fields.emptyState}
          value={form.emptyState}
          onChange={(emptyState) => update({ emptyState })}
          defaults={pairOf((l) => defaults[l].featured.emptyState)}
          maxLength={200}
          errors={errors}
          errorPath="emptyState"
          disabled={disabled}
          dictionary={fields}
        />
      </FieldGroup>

      <FieldGroup title={fields.groupButton}>
        <CtaFields
          ctaLabel={form.ctaLabel}
          ctaHref={form.ctaHref}
          onChange={update}
          defaults={{
            label: pairOf((l) => defaults[l].featured.ctaLabel),
            href: defaults.pt.featured.ctaHref,
          }}
          errors={errors}
          disabled={disabled}
          dictionary={fields}
        />
      </FieldGroup>

      <FieldGroup title={copy.products.title} description={copy.products.description}>
        <Box sx={{ maxWidth: 480, px: 1 }}>
          <Typography id={LIMIT_LABEL_ID} variant="body2" sx={{ fontWeight: 600 }}>
            {copy.limit}: {form.limit}
          </Typography>
          <Slider
            value={form.limit}
            min={HOME_FEATURED_LIMIT.min}
            max={HOME_FEATURED_LIMIT.max}
            step={1}
            marks
            valueLabelDisplay="auto"
            disabled={disabled}
            aria-labelledby={LIMIT_LABEL_ID}
            onChange={(_event, value) => update({ limit: Array.isArray(value) ? value[0] : value })}
          />
          <FormHelperText>
            {interpolate(copy.limitHelper, { min: HOME_FEATURED_LIMIT.min, max: HOME_FEATURED_LIMIT.max })}
          </FormHelperText>
        </Box>

        <FeaturedProductsManager
          locale={locale}
          dictionary={copy.products}
          limit={form.limit}
          canRead={canReadProducts}
          canManage={canManageProducts}
          onNotify={onNotify}
        />
      </FieldGroup>
    </Stack>
  );
}
