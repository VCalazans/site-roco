"use client";

import { useState, type FormEvent } from "react";
import AddIcon from "@mui/icons-material/Add";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import EditIcon from "@mui/icons-material/Edit";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/core/trpc-client";
import {
  certificationStatus,
  todayInBrazil,
  type CertificationStatus,
} from "@/modules/certifications/lib/certifications";
import { PortalFileUploader } from "@/modules/portal/components/shared/portal-file-uploader";
import type { PortalSettingsDictionary } from "@/modules/portal/lib/types";
import { interpolate } from "@/shared/lib/interpolate";
import { getAllowedContentTypes, getMaxBytes } from "@/shared/lib/upload-limits";

type Copy = PortalSettingsDictionary["certifications"];

const IMAGE_TYPES = getAllowedContentTypes("siteImage");

type FormState = {
  namePt: string;
  nameEn: string;
  notePt: string;
  noteEn: string;
  altPt: string;
  altEn: string;
  linkUrl: string;
  validUntil: string;
  active: boolean;
  imageKey: string | null;
};

const EMPTY_FORM: FormState = {
  namePt: "",
  nameEn: "",
  notePt: "",
  noteEn: "",
  altPt: "",
  altEn: "",
  linkUrl: "",
  validUntil: "",
  active: true,
  imageKey: null,
};

const STATUS_COLOR: Record<CertificationStatus, "success" | "warning" | "error" | "default"> = {
  valid: "success",
  expiringSoon: "warning",
  expired: "error",
  noExpiry: "default",
};

function formatDate(value: string, locale: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(locale === "en" ? "en-US" : "pt-BR", {
    timeZone: "UTC",
  });
}

/**
 * Configurações do Site › Certificações: selos do rodapé e da página Sobre
 * (ex.: Great Place To Work). Cada selo tem imagem, nome e linha curta em pt/en,
 * vigência e link opcional. Vencido some do site sozinho; aqui aparece
 * marcado, para a equipe renovar ou excluir.
 */
export function CertificationsManager({ copy, locale }: { copy: Copy; locale: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const listQuery = useQuery(trpc.certifications.list.queryOptions());
  const items = listQuery.data ?? [];
  const today = todayInBrazil();

  const [editing, setEditing] = useState<{ id: string | null; form: FormState; previewUrl: string | null } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: trpc.certifications.list.queryKey() });
  const presign = useMutation(trpc.certifications.presignImage.mutationOptions());
  const confirm = useMutation(trpc.certifications.confirmImage.mutationOptions());
  const create = useMutation(trpc.certifications.create.mutationOptions());
  const update = useMutation(trpc.certifications.update.mutationOptions());
  const remove = useMutation(
    trpc.certifications.delete.mutationOptions({
      onSuccess: () => {
        setNotice(copy.deleted);
        void invalidate();
      },
    })
  );
  const reorder = useMutation(trpc.certifications.reorder.mutationOptions({ onSuccess: () => void invalidate() }));

  const saving = create.isPending || update.isPending;
  const saveError = create.error?.message ?? update.error?.message ?? null;
  const listError = remove.error?.message ?? reorder.error?.message ?? null;

  function openNew() {
    create.reset();
    update.reset();
    setEditing({ id: null, form: EMPTY_FORM, previewUrl: null });
  }

  function openEdit(item: (typeof items)[number]) {
    create.reset();
    update.reset();
    setEditing({
      id: item.id,
      previewUrl: item.imageUrl,
      form: {
        namePt: item.namePt,
        nameEn: item.nameEn ?? "",
        notePt: item.notePt ?? "",
        noteEn: item.noteEn ?? "",
        altPt: item.altPt ?? "",
        altEn: item.altEn ?? "",
        linkUrl: item.linkUrl ?? "",
        validUntil: item.validUntil ?? "",
        active: item.active,
        imageKey: null,
      },
    });
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setEditing((current) => (current ? { ...current, form: { ...current.form, [key]: value } } : current));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const data = {
      ...editing.form,
      validUntil: editing.form.validUntil || null,
      imageKey: editing.form.imageKey,
    };
    try {
      if (editing.id) {
        await update.mutateAsync({ id: editing.id, data });
      } else {
        await create.mutateAsync(data);
      }
      setNotice(copy.saved);
      setEditing(null);
      void invalidate();
    } catch {
      // Erro do servidor fica no Alert do diálogo.
    }
  }

  function move(index: number, direction: -1 | 1) {
    const ids = items.map((item) => item.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorder.mutate({ ids });
  }

  function statusLabel(item: (typeof items)[number]): { label: string; color: "success" | "warning" | "error" | "default" } {
    if (!item.active) return { label: copy.status.inactive, color: "default" };
    const status = certificationStatus(item.validUntil, today);
    const date = item.validUntil ? formatDate(item.validUntil, locale) : "";
    return { label: interpolate(copy.status[status], { date }), color: STATUS_COLOR[status] };
  }

  const canSave = Boolean(editing?.form.namePt.trim()) && Boolean(editing?.form.imageKey || editing?.previewUrl);

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2, justifyContent: "space-between" }}>
        <Box>
          <Typography variant="h6" component="h2">
            {copy.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {copy.description}
          </Typography>
        </Box>
        <Box>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openNew} sx={{ whiteSpace: "nowrap" }}>
            {copy.add}
          </Button>
        </Box>
      </Stack>

      {notice ? (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      ) : null}
      {listError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {listError}
        </Alert>
      ) : null}
      {listQuery.isError ? <Alert severity="error">{copy.loadFailed}</Alert> : null}

      {listQuery.isLoading ? (
        <Skeleton variant="rounded" height={72} />
      ) : items.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {copy.empty}
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {items.map((item, index) => {
            const status = statusLabel(item);
            return (
              <Stack
                key={item.id}
                direction="row"
                spacing={2}
                sx={{ alignItems: "center", p: 1.5, border: 1, borderColor: "divider", borderRadius: 1 }}
              >
                <Box sx={{ width: 56, height: 72, flexShrink: 0, display: "grid", placeItems: "center" }}>
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- miniatura do R2/public (mesmo padrão do portal)
                    <img src={item.imageUrl} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                  ) : null}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2">{item.namePt}</Typography>
                  {item.notePt ? (
                    <Typography variant="body2" color="text.secondary">
                      {item.notePt}
                    </Typography>
                  ) : null}
                  <Chip size="small" color={status.color} variant="outlined" label={status.label} sx={{ mt: 0.5 }} />
                </Box>
                <Stack direction="row" spacing={0.5}>
                  <Tooltip title={copy.moveUp}>
                    <span>
                      <IconButton size="small" aria-label={copy.moveUp} disabled={index === 0 || reorder.isPending} onClick={() => move(index, -1)}>
                        <ArrowUpwardIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title={copy.moveDown}>
                    <span>
                      <IconButton
                        size="small"
                        aria-label={copy.moveDown}
                        disabled={index === items.length - 1 || reorder.isPending}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDownwardIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title={copy.edit}>
                    <IconButton size="small" aria-label={copy.edit} onClick={() => openEdit(item)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={copy.delete}>
                    <IconButton
                      size="small"
                      aria-label={copy.delete}
                      disabled={remove.isPending}
                      onClick={() => {
                        if (window.confirm(interpolate(copy.deleteConfirm, { name: item.namePt }))) {
                          remove.mutate({ id: item.id });
                        }
                      }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
            );
          })}
        </Stack>
      )}

      <Dialog open={Boolean(editing)} onClose={saving ? undefined : () => setEditing(null)} fullWidth maxWidth="md">
        {editing ? (
          <form onSubmit={save} noValidate>
            <DialogTitle>{editing.id ? copy.editTitle : copy.addTitle}</DialogTitle>
            <DialogContent>
              <Stack spacing={2.5} sx={{ pt: 1 }}>
                {saveError ? <Alert severity="error">{saveError}</Alert> : null}

                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    {copy.fields.image}
                  </Typography>
                  <PortalFileUploader
                    labels={copy.uploader}
                    acceptedTypes={IMAGE_TYPES}
                    maxSizeBytesFor={(contentType) => getMaxBytes("siteImage", contentType) ?? 0}
                    presign={(input) => presign.mutateAsync(input)}
                    confirm={async (input) => {
                      const result = await confirm.mutateAsync(input);
                      return { key: result.key, sizeBytes: result.sizeBytes };
                    }}
                    onUploaded={(uploaded) => setField("imageKey", uploaded.key)}
                    existingPreviewUrl={editing.previewUrl}
                    existingKind="image"
                  />
                  <Typography variant="caption" color="text.secondary">
                    {copy.fields.imageHelp}
                  </Typography>
                </Box>

                <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
                  <TextField
                    label={copy.fields.namePt}
                    value={editing.form.namePt}
                    onChange={(event) => setField("namePt", event.target.value)}
                    required
                    slotProps={{ htmlInput: { maxLength: 120 } }}
                  />
                  <TextField
                    label={copy.fields.nameEn}
                    value={editing.form.nameEn}
                    onChange={(event) => setField("nameEn", event.target.value)}
                    slotProps={{ htmlInput: { maxLength: 120 } }}
                  />
                  <TextField
                    label={copy.fields.notePt}
                    helperText={copy.fields.noteHelp}
                    value={editing.form.notePt}
                    onChange={(event) => setField("notePt", event.target.value)}
                    slotProps={{ htmlInput: { maxLength: 160 } }}
                  />
                  <TextField
                    label={copy.fields.noteEn}
                    value={editing.form.noteEn}
                    onChange={(event) => setField("noteEn", event.target.value)}
                    slotProps={{ htmlInput: { maxLength: 160 } }}
                  />
                  <TextField
                    label={copy.fields.validUntil}
                    helperText={copy.fields.validUntilHelp}
                    type="date"
                    value={editing.form.validUntil}
                    onChange={(event) => setField("validUntil", event.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                  <TextField
                    label={copy.fields.linkUrl}
                    helperText={copy.fields.linkUrlHelp}
                    value={editing.form.linkUrl}
                    onChange={(event) => setField("linkUrl", event.target.value)}
                    placeholder="https://"
                    slotProps={{ htmlInput: { maxLength: 500 } }}
                  />
                  <TextField
                    label={copy.fields.altPt}
                    helperText={copy.fields.altHelp}
                    value={editing.form.altPt}
                    onChange={(event) => setField("altPt", event.target.value)}
                    slotProps={{ htmlInput: { maxLength: 240 } }}
                  />
                  <TextField
                    label={copy.fields.altEn}
                    value={editing.form.altEn}
                    onChange={(event) => setField("altEn", event.target.value)}
                    slotProps={{ htmlInput: { maxLength: 240 } }}
                  />
                </Box>

                <FormControlLabel
                  control={
                    <Switch checked={editing.form.active} onChange={(event) => setField("active", event.target.checked)} />
                  }
                  label={copy.fields.active}
                />
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setEditing(null)} disabled={saving}>
                {copy.cancel}
              </Button>
              <Button type="submit" variant="contained" disabled={saving || !canSave}>
                {saving ? copy.saving : copy.save}
              </Button>
            </DialogActions>
          </form>
        ) : null}
      </Dialog>
    </Paper>
  );
}
