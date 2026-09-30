"use client";

import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { Locale } from "@/i18n/config";
import type { LocalizedText } from "@/modules/home/lib/home-content";
import type { PortalHomeContentDictionary } from "@/modules/portal/lib/home-content-dictionary";
import { interpolate } from "@/shared/lib/interpolate";
import { MAX_HREF_LENGTH } from "@/shared/lib/safe-href";
import type { FieldErrors } from "./home-editor-model";

/**
 * Peças de formulário compartilhadas pelos editores de seção. Regras que
 * valem para todas (RF19):
 *  - o texto PADRÃO do dicionário aparece como placeholder, com o rótulo
 *    sempre "encolhido" (`shrink`) — no MUI o placeholder só aparece com o
 *    rótulo no alto, então sem isso o operador só veria o padrão ao focar;
 *  - campo vazio = "usa o padrão" (dito no helper), para o operador sempre
 *    saber o que o site mostra.
 */

type FieldsDictionary = PortalHomeContentDictionary["fields"];

const LANGUAGES = ["pt", "en"] as const;

/** Estilo de texto só para leitor de tela (o `visuallyHidden` do MUI vive em `@mui/utils`, que não é dependência direta). */
export const srOnlySx = {
  border: 0,
  clip: "rect(0 0 0 0)",
  height: "1px",
  margin: "-1px",
  overflow: "hidden",
  padding: 0,
  position: "absolute",
  whiteSpace: "nowrap",
  width: "1px",
} as const;

// ---------------------------------------------------------------------------
// Texto nos dois idiomas
// ---------------------------------------------------------------------------

type LocalizedFieldProps = {
  label: string;
  value: LocalizedText;
  onChange: (next: LocalizedText) => void;
  /** Padrão do dicionário em cada idioma (placeholder); `undefined` = sem padrão. */
  defaults?: Record<Locale, string>;
  maxLength: number;
  errors: FieldErrors;
  /** Caminho do campo em `errors` (`headline` → `headline.pt` / `headline.en`). */
  errorPath: string;
  disabled: boolean;
  dictionary: FieldsDictionary;
  multiline?: boolean;
  minRows?: number;
  /** Dica do GRUPO (aparece abaixo dos dois campos). */
  helper?: string;
};

/** PT e EN lado a lado (empilhados no celular), sempre com o padrão à vista. */
export function LocalizedField({
  label,
  value,
  onChange,
  defaults,
  maxLength,
  errors,
  errorPath,
  disabled,
  dictionary,
  multiline = false,
  minRows = 2,
  helper,
}: LocalizedFieldProps) {
  return (
    <Box>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        {LANGUAGES.map((language) => {
          const text = value[language];
          const error = errors[`${errorPath}.${language}`];
          const languageName = language === "pt" ? dictionary.languagePt : dictionary.languageEn;
          return (
            <TextField
              key={language}
              label={interpolate(dictionary.localizedLabel, { label, language: languageName })}
              value={text}
              onChange={(event) => onChange({ ...value, [language]: event.target.value })}
              placeholder={defaults?.[language]}
              multiline={multiline}
              minRows={multiline ? minRows : undefined}
              disabled={disabled}
              error={Boolean(error)}
              helperText={
                error ??
                (text.trim() === ""
                  ? dictionary.emptyUsesDefault
                  : interpolate(dictionary.counter, { count: text.length, max: maxLength }))
              }
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { maxLength, lang: language },
              }}
            />
          );
        })}
      </Stack>
      {helper ? (
        <FormHelperText sx={{ mx: 1.75 }}>{helper}</FormHelperText>
      ) : null}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Link
// ---------------------------------------------------------------------------

type HrefFieldProps = {
  label: string;
  value: string;
  onChange: (next: string) => void;
  /** Link padrão do dicionário (placeholder + dica "vazio = usa o padrão"). */
  defaultHref?: string;
  error?: string;
  disabled: boolean;
  dictionary: FieldsDictionary;
};

export function HrefField({ label, value, onChange, defaultHref, error, disabled, dictionary }: HrefFieldProps) {
  const isEmpty = value.trim() === "";
  return (
    <TextField
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={defaultHref}
      disabled={disabled}
      error={Boolean(error)}
      helperText={
        error ?? (isEmpty && defaultHref ? interpolate(dictionary.hrefUsesDefault, { href: defaultHref }) : undefined)
      }
      slotProps={{
        inputLabel: { shrink: true },
        htmlInput: {
          maxLength: MAX_HREF_LENGTH,
          inputMode: "url",
          autoCapitalize: "none",
          autoCorrect: "off",
          spellCheck: false,
        },
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Botão (CTA): texto nos dois idiomas + link
// ---------------------------------------------------------------------------

type CtaFieldsProps = {
  ctaLabel: LocalizedText;
  ctaHref: string;
  onChange: (patch: { ctaLabel?: LocalizedText; ctaHref?: string }) => void;
  defaults: { label: Record<Locale, string>; href: string };
  errors: FieldErrors;
  disabled: boolean;
  dictionary: FieldsDictionary;
};

/** O botão da seção: rótulo PT/EN + link. As cinco seções têm um. */
export function CtaFields({ ctaLabel, ctaHref, onChange, defaults, errors, disabled, dictionary }: CtaFieldsProps) {
  return (
    <Stack spacing={2}>
      <LocalizedField
        label={dictionary.ctaLabel}
        value={ctaLabel}
        onChange={(next) => onChange({ ctaLabel: next })}
        defaults={defaults.label}
        maxLength={60}
        errors={errors}
        errorPath="ctaLabel"
        disabled={disabled}
        dictionary={dictionary}
      />
      <Box>
        <HrefField
          label={dictionary.ctaHref}
          value={ctaHref}
          onChange={(next) => onChange({ ctaHref: next })}
          defaultHref={defaults.href}
          error={errors.ctaHref}
          disabled={disabled}
          dictionary={dictionary}
        />
        <FormHelperText sx={{ mx: 1.75 }}>{dictionary.hrefHelper}</FormHelperText>
      </Box>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Interruptor e grupo
// ---------------------------------------------------------------------------

type SwitchFieldProps = {
  label: string;
  helper?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled: boolean;
};

export function SwitchField({ label, helper, checked, onChange, disabled }: SwitchFieldProps) {
  return (
    <Box>
      <FormControlLabel
        control={<Switch checked={checked} onChange={(event) => onChange(event.target.checked)} />}
        label={label}
        disabled={disabled}
      />
      {helper ? <FormHelperText sx={{ mt: -0.5, ml: 0.5 }}>{helper}</FormHelperText> : null}
    </Box>
  );
}

type FieldGroupProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

/** Bloco com título (h3) dentro de um editor de seção. */
export function FieldGroup({ title, description, children }: FieldGroupProps) {
  return (
    <Stack component="section" spacing={2}>
      <Box>
        <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        {description ? (
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        ) : null}
      </Box>
      {children}
    </Stack>
  );
}
