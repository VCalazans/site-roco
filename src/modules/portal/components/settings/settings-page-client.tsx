"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import CloseIcon from "@mui/icons-material/Close";
import InstagramIcon from "@mui/icons-material/Instagram";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PhoneForwardedIcon from "@mui/icons-material/PhoneForwarded";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import YouTubeIcon from "@mui/icons-material/YouTube";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/core/trpc-client";
import type { PortalSettingsDictionary } from "@/modules/portal/lib/types";
import {
  SOCIAL_NETWORKS,
  isCatalogLocation,
  isValidEmail,
  normalizePhone,
  normalizeSocialLink,
  parseSocialLinks,
  serializeSocialLinks,
  type SocialLinksForm,
  type SocialNetwork,
} from "@/modules/portal/lib/site-settings-form";
import { interpolate } from "@/shared/lib/interpolate";

/** Ícone e cor oficial de cada rede — o operador reconhece o campo pelo ícone. */
const NETWORK_ICONS: Record<SocialNetwork, typeof InstagramIcon> = {
  instagram: InstagramIcon,
  linkedin: LinkedInIcon,
  youtube: YouTubeIcon,
  whatsapp: WhatsAppIcon,
};
const NETWORK_COLORS: Record<SocialNetwork, string> = {
  instagram: "#E4405F",
  linkedin: "#0A66C2",
  youtube: "#FF0000",
  whatsapp: "#25D366",
};

function isSocialField(field: FieldKey): field is SocialNetwork {
  return (SOCIAL_NETWORKS as readonly string[]).includes(field);
}

type BlockKey = "contact" | "addresses" | "social" | "catalog";
type FieldKey =
  | "phone"
  | "email"
  | "addressMatriz"
  | "addressFilial"
  | SocialNetwork
  | "catalogPdf";
type SaveStatus = "saving" | "saved" | "error";

const BLOCK_ORDER: BlockKey[] = ["contact", "addresses", "social", "catalog"];

const BLOCK_FIELDS: Record<BlockKey, FieldKey[]> = {
  contact: ["phone", "email"],
  addresses: ["addressMatriz", "addressFilial"],
  social: [...SOCIAL_NETWORKS],
  catalog: ["catalogPdf"],
};

/** Chaves de `site_settings` de cada campo simples (as redes viajam juntas em `social.links`). */
const SETTING_KEY = {
  phone: "contact.phone",
  email: "contact.email",
  addressMatriz: "contact.address.matriz",
  addressFilial: "contact.address.filial",
  catalogPdf: "catalog.pdf-url",
} as const;
type SimpleFieldKey = keyof typeof SETTING_KEY;
const SOCIAL_SETTING_KEY = "social.links" as const;
/** As chaves aceitas por `siteSettings.set` que esta tela grava. */
type SettingWriteKey = (typeof SETTING_KEY)[SimpleFieldKey] | typeof SOCIAL_SETTING_KEY;

/** Obrigatórios: o servidor recusa valor vazio (`min(1)`); as redes são opcionais. */
const REQUIRED_FIELDS: ReadonlySet<FieldKey> = new Set([
  "phone",
  "email",
  "addressMatriz",
  "addressFilial",
  "catalogPdf",
]);

type ServerState = {
  values: Record<FieldKey, string>;
  raw: Map<string, string>;
  socialInvalid: boolean;
};

function readServerState(rows: { key: string; value: string }[]): ServerState {
  const raw = new Map(rows.map((row) => [row.key, row.value]));
  const social = parseSocialLinks(raw.get(SOCIAL_SETTING_KEY));
  return {
    raw,
    socialInvalid: social.invalid,
    values: {
      phone: raw.get(SETTING_KEY.phone) ?? "",
      email: raw.get(SETTING_KEY.email) ?? "",
      addressMatriz: raw.get(SETTING_KEY.addressMatriz) ?? "",
      addressFilial: raw.get(SETTING_KEY.addressFilial) ?? "",
      catalogPdf: raw.get(SETTING_KEY.catalogPdf) ?? "",
      ...social.values,
    },
  };
}

function blockOf(field: FieldKey): BlockKey {
  return BLOCK_ORDER.find((block) => BLOCK_FIELDS[block].includes(field)) ?? "contact";
}

/** Mensagem de erro do campo ("" = válido). */
function validateField(field: FieldKey, value: string, labels: PortalSettingsDictionary): string {
  const errors = labels.form.errors;
  const text = value.trim();
  if (text === "") return REQUIRED_FIELDS.has(field) ? errors.required : "";

  if (isSocialField(field)) {
    const result = normalizeSocialLink(field, text);
    if (result.kind !== "error") return "";
    switch (result.reason) {
      case "wrongNetwork":
        return interpolate(errors.wrongNetwork, { network: labels.fields[field].label });
      case "invalidPhone":
        return errors.invalidWhatsapp;
      case "tooLong":
        return errors.tooLong;
      default:
        return errors.invalidHandle;
    }
  }

  switch (field) {
    case "phone":
      return normalizePhone(text) === null ? errors.invalidPhone : "";
    case "email":
      return isValidEmail(text) ? "" : errors.invalidEmail;
    case "catalogPdf":
      return isCatalogLocation(text) ? "" : errors.invalidPath;
    default:
      return "";
  }
}

const FIELD_INPUT: Partial<
  Record<FieldKey, { type: "email" | "tel" | "url"; inputMode?: "email" | "tel" | "url" }>
> = {
  phone: { type: "tel", inputMode: "tel" },
  email: { type: "email", inputMode: "email" },
  catalogPdf: { type: "url", inputMode: "url" },
};

const MULTILINE_FIELDS: ReadonlySet<FieldKey> = new Set(["addressMatriz", "addressFilial"]);

type SettingsBlockProps = {
  title: string;
  description: string;
  labels: PortalSettingsDictionary["form"];
  dirty: boolean;
  status?: SaveStatus;
  onSubmit: () => void;
  onReset: () => void;
  notice?: ReactNode;
  children: ReactNode;
};

/** Cartão de um bloco: cabeçalho, campos e rodapé com salvar/descartar e o resultado. */
function SettingsBlock({
  title,
  description,
  labels,
  dirty,
  status,
  onSubmit,
  onReset,
  notice,
  children,
}: SettingsBlockProps) {
  const saving = status === "saving";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dirty && !saving) onSubmit();
  }

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
      <Box component="form" noValidate onSubmit={handleSubmit}>
        <Stack spacing={2.5}>
          <Box>
            <Stack direction="row" spacing={1.5} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
              <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 600 }}>
                {title}
              </Typography>
              {dirty && !saving ? (
                <Chip label={labels.unsaved} size="small" color="warning" variant="outlined" />
              ) : null}
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          </Box>

          {notice}

          {children}

          <Stack
            direction="row"
            spacing={1.5}
            useFlexGap
            sx={{ alignItems: "center", flexWrap: "wrap" }}
          >
            <Button
              type="submit"
              variant="contained"
              disabled={!dirty || saving}
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
            >
              {saving ? labels.saving : labels.save}
            </Button>
            {dirty && !saving ? (
              <Button type="button" onClick={onReset}>
                {labels.reset}
              </Button>
            ) : null}
            {/* Resultado por bloco, no próprio rodapé: quem salvou "Contato" não
                fica na dúvida se "Redes sociais" também foi. `role="status"`
                anuncia o resultado a leitores de tela. */}
            <Box role="status" aria-live="polite" sx={{ minHeight: 24, display: "flex", alignItems: "center" }}>
              {status === "saved" ? (
                <Typography variant="body2" color="success.main">
                  {labels.blockSaved}
                </Typography>
              ) : null}
              {status === "error" ? (
                <Typography variant="body2" color="error.main">
                  {labels.errors.saveFailed}
                </Typography>
              ) : null}
            </Box>
          </Stack>
        </Stack>
      </Box>
    </Paper>
  );
}

type SettingsPageClientProps = {
  labels: PortalSettingsDictionary;
};

/**
 * Configurações do site (contato, endereços, redes sociais, catálogo em PDF),
 * agrupadas em blocos com salvamento INDEPENDENTE: cada bloco tem o próprio
 * botão, validação e resultado. As redes sociais deixaram de ser um JSON cru:
 * são quatro campos que aceitam o que o operador souber digitar (link, @perfil,
 * nome da página, número de WhatsApp) — `normalizeSocialLink` monta o link
 * canônico, que é o que vai gravado no mesmo `social.links` (JSON string) que
 * o rodapé lê. Cada campo mostra o link final e um botão para testá-lo.
 */
export function SettingsPageClient({ labels }: SettingsPageClientProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const listQuery = useQuery(trpc.siteSettings.list.queryOptions());
  const setMutation = useMutation(trpc.siteSettings.set.mutationOptions());

  const [drafts, setDrafts] = useState<Partial<Record<FieldKey, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [attempted, setAttempted] = useState<Partial<Record<BlockKey, boolean>>>({});
  const [status, setStatus] = useState<Partial<Record<BlockKey, SaveStatus>>>({});

  const server = useMemo(() => readServerState(listQuery.data ?? []), [listQuery.data]);

  const valueOf = (field: FieldKey): string => drafts[field] ?? server.values[field];
  const errorOf = (field: FieldKey): string => validateField(field, valueOf(field), labels);
  /** Link final de uma rede (o que vai para o rodapé), ou `null` se vazio/inválido. */
  const socialUrlOf = (network: SocialNetwork): string | null => {
    const result = normalizeSocialLink(network, valueOf(network));
    return result.kind === "ok" ? result.url : null;
  };
  const isDirty = (block: BlockKey): boolean =>
    BLOCK_FIELDS[block].some((field) => valueOf(field).trim() !== server.values[field].trim());

  function updateStatus(block: BlockKey, next: SaveStatus | undefined) {
    setStatus((current) => ({ ...current, [block]: next }));
  }

  function handleChange(field: FieldKey, value: string) {
    setDrafts((current) => ({ ...current, [field]: value }));
    // Editar depois de salvar/falhar: o resultado antigo deixa de descrever a tela.
    updateStatus(blockOf(field), undefined);
  }

  function resetBlock(block: BlockKey) {
    const fields = BLOCK_FIELDS[block];
    setDrafts((current) => {
      const next = { ...current };
      for (const field of fields) delete next[field];
      return next;
    });
    setTouched((current) => {
      const next = { ...current };
      for (const field of fields) delete next[field];
      return next;
    });
    setAttempted((current) => ({ ...current, [block]: false }));
    updateStatus(block, undefined);
  }

  /** Pares chave/valor a gravar no bloco — só o que mudou em relação ao servidor. */
  function buildWrites(block: BlockKey): { key: SettingWriteKey; value: string }[] {
    const writes: { key: SettingWriteKey; value: string }[] = [];

    if (block === "social") {
      // Grava o link CANÔNICO montado de cada campo (quem digitou "@roco" salva
      // https://www.instagram.com/roco) — o rodapé só entende URL completa.
      const values = Object.fromEntries(
        SOCIAL_NETWORKS.map((network) => [network, socialUrlOf(network) ?? ""])
      ) as SocialLinksForm;
      const serialized = serializeSocialLinks(values);
      // Valor salvo em formato inválido também precisa ser substituído, mesmo
      // que os campos (todos vazios) não tenham mudado.
      if (server.socialInvalid || serialized !== server.raw.get(SOCIAL_SETTING_KEY)) {
        writes.push({ key: SOCIAL_SETTING_KEY, value: serialized });
      }
      return writes;
    }

    for (const field of BLOCK_FIELDS[block] as SimpleFieldKey[]) {
      const text = valueOf(field).trim();
      // Telefone é gravado só com dígitos (formato do seed e do `wa.me`).
      const value = field === "phone" ? (normalizePhone(text) ?? text) : text;
      if (value !== (server.raw.get(SETTING_KEY[field]) ?? "")) {
        writes.push({ key: SETTING_KEY[field], value });
      }
    }
    return writes;
  }

  async function saveBlock(block: BlockKey) {
    setAttempted((current) => ({ ...current, [block]: true }));
    if (BLOCK_FIELDS[block].some((field) => errorOf(field) !== "")) return;

    updateStatus(block, "saving");
    try {
      const writes = buildWrites(block);
      for (const write of writes) {
        await setMutation.mutateAsync({ key: write.key, value: write.value, type: "string" });
      }
      // Reflete o que acabou de ser gravado no cache ANTES de largar os
      // rascunhos: senão os campos voltariam ao valor antigo até o refetch
      // terminar (ou para sempre, se ele falhar). O refetch abaixo só confirma.
      queryClient.setQueryData(trpc.siteSettings.list.queryKey(), (current) => {
        const rows = current ?? [];
        const merged = rows.map((row) => {
          const write = writes.find((item) => item.key === row.key);
          return write ? { ...row, value: write.value } : row;
        });
        for (const write of writes) {
          if (!rows.some((row) => row.key === write.key)) {
            merged.push({
              key: write.key,
              value: write.value,
              type: "string",
              description: null,
              updatedAt: new Date().toISOString(),
            });
          }
        }
        return merged;
      });
      void queryClient.invalidateQueries(trpc.siteSettings.list.queryFilter());
      resetBlock(block);
      updateStatus(block, "saved");
      window.setTimeout(() => {
        setStatus((current) =>
          current[block] === "saved" ? { ...current, [block]: undefined } : current
        );
      }, 5000);
    } catch {
      updateStatus(block, "error");
    }
  }

  function renderSocialField(network: SocialNetwork) {
    const error = attempted.social || touched[network] ? errorOf(network) : "";
    const copy = labels.fields[network];
    const url = socialUrlOf(network);
    const value = valueOf(network);
    const saving = status.social === "saving";
    const Icon = NETWORK_ICONS[network];
    const contactNumber = normalizePhone(valueOf("phone"));
    const testLabel = interpolate(labels.social.test, { network: copy.label });

    return (
      <Stack key={network} spacing={0.75}>
        <TextField
          label={copy.label}
          placeholder={copy.placeholder}
          value={value}
          onChange={(event) => handleChange(network, event.target.value)}
          onBlur={() => setTouched((current) => ({ ...current, [network]: true }))}
          error={Boolean(error)}
          helperText={error || (url ? interpolate(labels.social.linkPreview, { url }) : copy.hint)}
          disabled={saving}
          autoComplete="off"
          slotProps={{
            htmlInput: {
              inputMode: network === "whatsapp" ? "tel" : "text",
              spellCheck: false,
              autoCapitalize: "none",
            },
            formHelperText: { sx: { overflowWrap: "anywhere" } },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Icon sx={{ color: NETWORK_COLORS[network] }} />
                </InputAdornment>
              ),
              endAdornment:
                value.trim() !== "" ? (
                  <InputAdornment position="end">
                    {url ? (
                      <Tooltip title={testLabel}>
                        <IconButton
                          size="small"
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={testLabel}
                        >
                          <OpenInNewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : null}
                    <IconButton
                      size="small"
                      onClick={() => handleChange(network, "")}
                      aria-label={interpolate(labels.social.clear, { network: copy.label })}
                      disabled={saving}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
            },
          }}
        />
        {/* Atalho: o WhatsApp da empresa quase sempre é o mesmo telefone do
            bloco Contato — um clique em vez de redigitar o número. */}
        {network === "whatsapp" && value.trim() === "" && contactNumber ? (
          <Box>
            <Button
              size="small"
              startIcon={<PhoneForwardedIcon fontSize="small" />}
              onClick={() => handleChange("whatsapp", contactNumber)}
              disabled={saving}
            >
              {labels.social.useContactPhone}
            </Button>
          </Box>
        ) : null}
      </Stack>
    );
  }

  /** Prévia do rodapé: os ícones que vão aparecer, na ordem do site, clicáveis. */
  function renderFooterPreview() {
    const active = SOCIAL_NETWORKS.flatMap((network) => {
      const url = socialUrlOf(network);
      return url ? [{ network, url }] : [];
    });
    return (
      <Box sx={{ borderTop: 1, borderColor: "divider", pt: 2 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
          {labels.social.footerPreview}
        </Typography>
        {active.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {labels.social.footerPreviewEmpty}
          </Typography>
        ) : (
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            {active.map(({ network, url }) => {
              const Icon = NETWORK_ICONS[network];
              return (
                <Chip
                  key={network}
                  icon={<Icon sx={{ color: `${NETWORK_COLORS[network]} !important` }} />}
                  label={labels.fields[network].label}
                  component="a"
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  clickable
                  variant="outlined"
                />
              );
            })}
          </Stack>
        )}
      </Box>
    );
  }

  function renderField(field: FieldKey) {
    if (isSocialField(field)) return renderSocialField(field);
    const block = blockOf(field);
    const error = attempted[block] || touched[field] ? errorOf(field) : "";
    const copy = labels.fields[field];
    const input = FIELD_INPUT[field];
    const multiline = MULTILINE_FIELDS.has(field);

    return (
      <TextField
        key={field}
        label={copy.label}
        value={valueOf(field)}
        onChange={(event) => handleChange(field, event.target.value)}
        onBlur={() => setTouched((current) => ({ ...current, [field]: true }))}
        error={Boolean(error)}
        helperText={error || copy.hint}
        required={REQUIRED_FIELDS.has(field)}
        disabled={status[block] === "saving"}
        multiline={multiline}
        minRows={multiline ? 2 : undefined}
        type={input?.type ?? "text"}
        autoComplete="off"
        slotProps={{ htmlInput: input?.inputMode ? { inputMode: input.inputMode } : undefined }}
      />
    );
  }

  const blockCopy = labels.blocks;

  if (listQuery.isLoading) {
    return (
      <Box sx={{ maxWidth: 960, mx: "auto" }}>
        <Skeleton variant="text" width={280} sx={{ fontSize: "2rem" }} />
        <Skeleton variant="text" width={420} sx={{ mb: 3 }} />
        <Stack spacing={3} aria-hidden>
          {BLOCK_ORDER.map((block) => (
            <Skeleton key={block} variant="rounded" height={block === "social" ? 260 : 190} />
          ))}
        </Stack>
      </Box>
    );
  }

  if (listQuery.isError) {
    return <Alert severity="error">{labels.errors.loadFailed}</Alert>;
  }

  return (
    <Box sx={{ maxWidth: 960, mx: "auto" }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {labels.title}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {labels.subtitle}
        </Typography>
      </Box>

      <Stack spacing={3}>
        {BLOCK_ORDER.map((block) => (
          <SettingsBlock
            key={block}
            title={blockCopy[block].title}
            description={blockCopy[block].description}
            labels={labels.form}
            dirty={isDirty(block)}
            status={status[block]}
            onSubmit={() => void saveBlock(block)}
            onReset={() => resetBlock(block)}
            notice={
              block === "social" && server.socialInvalid ? (
                <Alert severity="warning">{labels.form.errors.storedInvalid}</Alert>
              ) : undefined
            }
          >
            <Box
              sx={{
                display: "grid",
                gap: 2.5,
                gridTemplateColumns:
                  block === "contact" || block === "social"
                    ? { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }
                    : "1fr",
              }}
            >
              {BLOCK_FIELDS[block].map((field) => renderField(field))}
            </Box>
            {block === "social" ? renderFooterPreview() : null}
          </SettingsBlock>
        ))}
      </Stack>
    </Box>
  );
}
