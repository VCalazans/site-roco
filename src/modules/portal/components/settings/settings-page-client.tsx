"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/core/trpc-client";
import type { PortalSettingsDictionary } from "@/modules/portal/lib/types";

type SettingKey =
  | "contact.phone"
  | "contact.email"
  | "contact.address.matriz"
  | "contact.address.filial"
  | "social.links";

type SettingMetaItem = {
  key: SettingKey;
  label: string;
  hint: string;
  multiline?: boolean;
};

const SETTING_META: SettingMetaItem[] = [
  {
    key: "contact.phone",
    label: "Telefone / WhatsApp",
    hint: "Número com código do país, ex.: 554733352012",
  },
  {
    key: "contact.email",
    label: "E-mail público",
    hint: "Ex.: vendas@roco.com.br",
  },
  {
    key: "contact.address.matriz",
    label: "Endereço da matriz",
    hint: "Ex.: Rua Amsterdam, 853 - Itoupavazinha, Blumenau - SC, CEP 89070-490",
  },
  {
    key: "contact.address.filial",
    label: "Descrição da filial",
    hint: "Texto descritivo da unidade fabril em Gaspar.",
  },
  {
    key: "social.links",
    label: "Redes sociais (JSON)",
    hint: 'Ex.: {"instagram":"...","linkedin":"...","youtube":"...","whatsapp":"..."}',
    multiline: true,
  },
];

type SettingsPageClientProps = {
  labels: PortalSettingsDictionary;
};

export function SettingsPageClient({ labels }: SettingsPageClientProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const listQuery = useQuery(trpc.siteSettings.list.queryOptions());

  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setMutation = useMutation(
    trpc.siteSettings.set.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.siteSettings.list.queryOptions());
      },
    })
  );

  const rows = listQuery.data ?? [];

  const getValue = (key: SettingKey): string => {
    if (key in values) return values[key]!;
    const row = rows.find((r) => r.key === key);
    return row?.value ?? "";
  };

  const handleChange = (key: SettingKey, val: string) => {
    setValues((prev) => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const handleSave = async (key: SettingKey) => {
    const value = getValue(key).trim();
    if (!value) {
      setErrors((prev) => ({ ...prev, [key]: labels.form.errors.required }));
      return;
    }
    try {
      await setMutation.mutateAsync({ key, value, type: "string" });
      setSaved((prev) => ({ ...prev, [key]: true }));
      setTimeout(() => setSaved((prev) => ({ ...prev, [key]: false })), 2500);
    } catch {
      setErrors((prev) => ({
        ...prev,
        [key]: labels.form.errors.saveFailed,
      }));
    }
  };

  if (listQuery.isLoading) {
    return (
      <Stack spacing={2}>
        {SETTING_META.map((meta) => (
          <Paper key={meta.key} sx={{ p: 3 }}>
            <Box sx={{ height: 60, bgcolor: "action.hover", borderRadius: 1 }} />
          </Paper>
        ))}
      </Stack>
    );
  }

  if (listQuery.isError) {
    return <Alert severity="error">{labels.errors.loadFailed}</Alert>;
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700 }} gutterBottom>
          {labels.title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {labels.subtitle}
        </Typography>
      </Box>

      <Divider />

      <Stack spacing={3}>
        {SETTING_META.map((meta) => {
          const value = getValue(meta.key);
          const error = errors[meta.key];
          const isSaving = setMutation.isPending;
          const isSaved = saved[meta.key] ?? false;

          return (
            <Paper key={meta.key} sx={{ p: 3 }}>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: { xs: "column", md: "row" },
                  gap: 3,
                  alignItems: { md: "flex-start" },
                }}
              >
                {/* Label */}
                <Box sx={{ flex: "0 0 200px" }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }} gutterBottom>
                    {meta.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {meta.hint}
                  </Typography>
                </Box>

                {/* Input + Save */}
                <Box sx={{ flex: 1, display: "flex", gap: 1 }}>
                  <TextField
                    fullWidth
                    size="small"
                    multiline={meta.multiline}
                    rows={meta.multiline ? 4 : 1}
                    value={value}
                    onChange={(e) => handleChange(meta.key, e.target.value)}
                    error={!!error}
                    helperText={error}
                    disabled={isSaving}
                  />
                  <Button
                    variant="outlined"
                    color={isSaved ? "success" : "primary"}
                    onClick={() => handleSave(meta.key)}
                    disabled={isSaving || !value.trim()}
                    sx={{ whiteSpace: "nowrap", minWidth: 96 }}
                  >
                    {isSaved ? labels.form.saved : isSaving ? "…" : labels.form.save}
                  </Button>
                </Box>
              </Box>
            </Paper>
          );
        })}
      </Stack>
    </Stack>
  );
}
