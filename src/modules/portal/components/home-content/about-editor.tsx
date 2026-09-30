"use client";

import AddIcon from "@mui/icons-material/Add";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormHelperText from "@mui/material/FormHelperText";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { interpolate } from "@/shared/lib/interpolate";
import { CtaFields, FieldGroup, LocalizedField, SwitchField } from "./fields";
import {
  HOME_MAX_HIGHLIGHTS,
  emptyHighlight,
  moveItem,
  prefillHighlights,
  type HighlightForm,
} from "./home-editor-model";
import { ItemActions } from "./item-actions";
import { pairOf, type SectionEditorProps } from "./section-editor-props";

/** Institucional: textos, destaques (lista) e botão. */
export function AboutEditor({
  form,
  onChange,
  locale,
  defaults,
  errors,
  disabled,
  dictionary,
}: SectionEditorProps<"about">) {
  const fields = dictionary.fields;
  const copy = dictionary.about.highlights;
  const update = (patch: Partial<typeof form>) => onChange({ ...form, ...patch });
  const highlights = form.highlights;

  function updateHighlight(index: number, patch: Partial<HighlightForm>) {
    if (!highlights) return;
    update({ highlights: highlights.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
  }

  return (
    <Stack spacing={4}>
      <FieldGroup title={fields.groupTexts}>
        <LocalizedField
          label={fields.eyebrow}
          value={form.eyebrow}
          onChange={(eyebrow) => update({ eyebrow })}
          defaults={pairOf((l) => defaults[l].about.eyebrow)}
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
          defaults={pairOf((l) => defaults[l].about.headline)}
          maxLength={120}
          errors={errors}
          errorPath="headline"
          disabled={disabled}
          dictionary={fields}
        />
        <LocalizedField
          label={fields.paragraphs}
          value={form.paragraphs}
          onChange={(paragraphs) => update({ paragraphs })}
          defaults={pairOf((l) => defaults[l].about.paragraphs)}
          maxLength={2400}
          errors={errors}
          errorPath="paragraphs"
          disabled={disabled}
          dictionary={fields}
          multiline
          minRows={7}
          helper={fields.paragraphsHelper}
        />
      </FieldGroup>

      <FieldGroup title={copy.title} description={copy.description}>
        {highlights === null ? (
          <Paper variant="outlined" sx={{ p: 2, bgcolor: "action.hover" }}>
            <Typography variant="body2" color="text.secondary">
              {copy.usingDefault}
            </Typography>
            <Box component="ul" sx={{ m: 0, mt: 1.5, pl: 2.5 }}>
              {defaults[locale].about.highlights.map((item) => (
                <Typography key={item.label} component="li" variant="body2">
                  <strong>{item.label}</strong> — {item.value}
                </Typography>
              ))}
            </Box>
            {!disabled ? (
              <Button
                variant="outlined"
                sx={{ mt: 2 }}
                onClick={() => update({ highlights: prefillHighlights(defaults) })}
              >
                {copy.customize}
              </Button>
            ) : null}
          </Paper>
        ) : (
          <Stack spacing={2}>
            {highlights.map((item, index) => {
              const position = String(index + 1);
              return (
                <Paper key={index} variant="outlined" sx={{ p: 2 }}>
                  <Stack spacing={2}>
                    <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
                      <Typography variant="subtitle2" component="h4">
                        {interpolate(copy.itemTitle, { position })}
                      </Typography>
                      <ItemActions
                        index={index}
                        count={highlights.length}
                        disabled={disabled}
                        removeDisabled={highlights.length <= 1}
                        onMove={(delta) => update({ highlights: moveItem(highlights, index, index + delta) })}
                        onRemove={() => update({ highlights: highlights.filter((_, i) => i !== index) })}
                        moveUpLabel={interpolate(copy.moveUpAria, { position })}
                        moveDownLabel={interpolate(copy.moveDownAria, { position })}
                        removeLabel={interpolate(copy.removeAria, { position })}
                      />
                    </Stack>
                    <LocalizedField
                      label={fields.itemLabel}
                      value={item.label}
                      onChange={(label) => updateHighlight(index, { label })}
                      maxLength={60}
                      errors={errors}
                      errorPath={`highlights.${index}.label`}
                      disabled={disabled}
                      dictionary={fields}
                    />
                    <LocalizedField
                      label={fields.itemValue}
                      value={item.value}
                      onChange={(value) => updateHighlight(index, { value })}
                      maxLength={160}
                      errors={errors}
                      errorPath={`highlights.${index}.value`}
                      disabled={disabled}
                      dictionary={fields}
                    />
                  </Stack>
                </Paper>
              );
            })}

            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }} useFlexGap>
              <Button
                startIcon={<AddIcon />}
                disabled={disabled || highlights.length >= HOME_MAX_HIGHLIGHTS}
                onClick={() => update({ highlights: [...highlights, emptyHighlight()] })}
              >
                {copy.add}
              </Button>
              <Button
                color="inherit"
                startIcon={<RestartAltIcon />}
                disabled={disabled}
                onClick={() => update({ highlights: null })}
              >
                {copy.useDefaultList}
              </Button>
            </Stack>
            {highlights.length >= HOME_MAX_HIGHLIGHTS ? (
              <FormHelperText>{interpolate(copy.maxReached, { max: HOME_MAX_HIGHLIGHTS })}</FormHelperText>
            ) : null}
            {highlights.length === 1 ? <FormHelperText>{copy.minOne}</FormHelperText> : null}
          </Stack>
        )}

        <SwitchField
          label={dictionary.about.showCatalogStats}
          helper={dictionary.about.showCatalogStatsHelper}
          checked={form.showCatalogStats}
          onChange={(showCatalogStats) => update({ showCatalogStats })}
          disabled={disabled}
        />
      </FieldGroup>

      <FieldGroup title={fields.groupButton}>
        <CtaFields
          ctaLabel={form.ctaLabel}
          ctaHref={form.ctaHref}
          onChange={update}
          defaults={{
            label: pairOf((l) => defaults[l].about.ctaLabel),
            href: defaults.pt.about.ctaHref,
          }}
          errors={errors}
          disabled={disabled}
          dictionary={fields}
        />
      </FieldGroup>
    </Stack>
  );
}
