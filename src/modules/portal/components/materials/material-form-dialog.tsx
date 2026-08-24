"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/core/trpc-client";
import { PortalFileUploader } from "@/modules/portal/components/shared/portal-file-uploader";
import type { PortalDictionary } from "@/modules/portal/lib/types";
import { interpolate } from "@/shared/lib/interpolate";

/** Espelha `materialContentTypeSchema` de `src/server/trpc/routers/materials.ts`. */
type MaterialContentType =
  | "application/pdf"
  | "video/mp4"
  | "video/webm"
  | "image/jpeg"
  | "image/png"
  | "image/webp";

/**
 * Espelha o campo `material` de `src/server/lib/upload-limits.ts` — só para
 * pré-checagem de UX no client (o servidor é a fonte de verdade real).
 * Limites diferem por tipo: documento/imagem 20 MB, vídeo 200 MB.
 */
const MATERIAL_MAX_BYTES: Record<MaterialContentType, number> = {
  "application/pdf": 20 * 1024 * 1024,
  "video/mp4": 200 * 1024 * 1024,
  "video/webm": 200 * 1024 * 1024,
  "image/jpeg": 20 * 1024 * 1024,
  "image/png": 20 * 1024 * 1024,
  "image/webp": 20 * 1024 * 1024,
};
const MATERIAL_TYPES = Object.keys(MATERIAL_MAX_BYTES) as MaterialContentType[];

function isMaterialContentType(value: string): value is MaterialContentType {
  return Object.hasOwn(MATERIAL_MAX_BYTES, value);
}
/**
 * O dicionário só prevê um único placeholder `{size}` em
 * `materials.form.upload.maxSize`, mas o campo aceita tipos com limites
 * diferentes entre si (documento/imagem 20 MB, vídeo 200 MB) — notação
 * compacta sem depender de palavras localizadas (evita cravar "vídeo"/
 * "video" a partir de um componente sem acesso ao locale). Ver relatório
 * final para o racional completo.
 */
const MATERIAL_MAX_SIZE_LABEL = "20/200 MB";

const CATEGORY_OPTIONS = ["commercial_policy", "logistics", "contacts", "training", "other"] as const;

/** Arquivo novo upado nesta sessão do dialog (presign→PUT→confirm já concluído). */
type NewUpload = {
  key: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
};

type FormState = {
  titlePt: string;
  titleEn: string;
  descriptionPt: string;
  descriptionEn: string;
  category: string;
  published: boolean;
  /** `null` = usuário não trocou o arquivo nesta sessão (edição preserva o
   *  arquivo existente via patch parcial; criação exige um upload). */
  newUpload: NewUpload | null;
};

const EMPTY: FormState = {
  titlePt: "",
  titleEn: "",
  descriptionPt: "",
  descriptionEn: "",
  category: "",
  published: false,
  newUpload: null,
};

type MaterialFormDialogProps = {
  open: boolean;
  onClose: () => void;
  materialId: string | null;
  dictionary: PortalDictionary["materials"];
  errorLabel: string;
};

/**
 * Mirror simplificado de `hero-form-dialog.tsx` (sem abas — só um form
 * direto): título/descrição PT+EN, categoria, arquivo (upload obrigatório
 * — `materials.r2Key` é NOT NULL no schema) e toggle de publicação.
 */
export function MaterialFormDialog({
  open,
  onClose,
  materialId,
  dictionary,
  errorLabel,
}: MaterialFormDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [currentId, setCurrentId] = useState<string | null>(materialId);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [hydratedFrom, setHydratedFrom] = useState<unknown>(undefined);

  const detailQuery = useQuery(
    trpc.materials.list.queryOptions(undefined, {
      enabled: Boolean(currentId) && open,
      select: (data) => data.find((m) => m.id === currentId) ?? null,
    })
  );

  if (detailQuery.data && detailQuery.data !== hydratedFrom) {
    const m = detailQuery.data;
    setHydratedFrom(m);
    setForm({
      titlePt: m.titlePt,
      titleEn: m.titleEn ?? "",
      descriptionPt: m.descriptionPt ?? "",
      descriptionEn: m.descriptionEn ?? "",
      category: m.category ?? "",
      published: m.published,
      newUpload: null,
    });
  }

  if (materialId !== currentId) {
    setCurrentId(materialId);
    setHydratedFrom(undefined);
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: trpc.materials.list.queryKey() });
  }

  const createMutation = useMutation(
    trpc.materials.create.mutationOptions({
      onSuccess: (created) => {
        setCurrentId(created.id);
        invalidate();
      },
    })
  );
  const updateMutation = useMutation(
    trpc.materials.update.mutationOptions({ onSuccess: invalidate })
  );
  const presignMutation = useMutation(trpc.materials.presignUpload.mutationOptions());
  const confirmMutation = useMutation(trpc.materials.confirmUpload.mutationOptions());

  const isEditing = Boolean(currentId);
  const isSaving = createMutation.isPending || updateMutation.isPending;

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  /** Campos comuns a create/update — nunca inclui os de arquivo (condicionais). */
  function buildBasePayload() {
    return {
      titlePt: form.titlePt.trim(),
      titleEn: form.titleEn || undefined,
      descriptionPt: form.descriptionPt || undefined,
      descriptionEn: form.descriptionEn || undefined,
      category: form.category || undefined,
      published: form.published,
    };
  }

  /** Patch parcial para `update` — só inclui campos de arquivo se o usuário
   *  trocou o arquivo nesta sessão; caso contrário o servidor preserva o
   *  arquivo existente (schema `updateInputSchema` é `.partial()`). */
  function buildUpdatePayload() {
    const base = buildBasePayload();
    if (!form.newUpload) {
      return base;
    }
    return {
      ...base,
      r2Key: form.newUpload.key,
      filename: form.newUpload.filename,
      contentType: form.newUpload.contentType as MaterialContentType,
      sizeBytes: form.newUpload.sizeBytes,
    };
  }

  /** Payload de criação — arquivo é sempre obrigatório (`r2Key` NOT NULL no
   *  schema); chamador garante `form.newUpload` não-nulo (ver `canSave`). */
  function buildCreatePayload(newUpload: NewUpload) {
    return {
      ...buildBasePayload(),
      r2Key: newUpload.key,
      filename: newUpload.filename,
      contentType: newUpload.contentType as MaterialContentType,
      sizeBytes: newUpload.sizeBytes,
    };
  }

  async function handleSave() {
    if (currentId) {
      await updateMutation.mutateAsync({ id: currentId, ...buildUpdatePayload() });
      return;
    }
    if (!form.newUpload) {
      return;
    }
    await createMutation.mutateAsync(buildCreatePayload(form.newUpload));
  }

  const hasError = createMutation.isError || updateMutation.isError || detailQuery.isError;
  const canSave =
    form.titlePt.trim().length > 0 &&
    (isEditing || form.newUpload !== null) &&
    !isSaving;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle>{isEditing ? dictionary.form.editTitle : dictionary.form.createTitle}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label={dictionary.form.fields.titlePt}
              value={form.titlePt}
              onChange={(e) => setField("titlePt", e.target.value)}
              required
              fullWidth
            />
            <TextField
              label={dictionary.form.fields.titleEn}
              value={form.titleEn}
              onChange={(e) => setField("titleEn", e.target.value)}
              fullWidth
            />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label={dictionary.form.fields.descriptionPt}
              value={form.descriptionPt}
              onChange={(e) => setField("descriptionPt", e.target.value)}
              multiline
              minRows={2}
              fullWidth
            />
            <TextField
              label={dictionary.form.fields.descriptionEn}
              value={form.descriptionEn}
              onChange={(e) => setField("descriptionEn", e.target.value)}
              multiline
              minRows={2}
              fullWidth
            />
          </Stack>

          <TextField
            select
            label={dictionary.form.fields.category}
            value={form.category}
            onChange={(e) => setField("category", e.target.value)}
            fullWidth
          >
            <MenuItem value="">—</MenuItem>
            {CATEGORY_OPTIONS.map((option) => (
              <MenuItem key={option} value={option}>
                {dictionary.categories[option]}
              </MenuItem>
            ))}
          </TextField>

          <Stack spacing={1}>
            <PortalFileUploader
              labels={{
                dropzone: dictionary.form.upload.dropzone,
                maxSize: interpolate(dictionary.form.upload.maxSize, { size: MATERIAL_MAX_SIZE_LABEL }),
                accepted: dictionary.form.upload.accepted,
                remove: dictionary.form.upload.remove,
                replace: dictionary.form.upload.replace,
                uploading: dictionary.form.upload.uploading,
                uploadError: dictionary.form.upload.uploadError,
              }}
              acceptedTypes={MATERIAL_TYPES}
              maxSizeBytesFor={(contentType) =>
                isMaterialContentType(contentType) ? MATERIAL_MAX_BYTES[contentType] : 0
              }
              presign={(input) =>
                presignMutation.mutateAsync({
                  ...input,
                  contentType: input.contentType as MaterialContentType,
                })
              }
              confirm={(input) =>
                confirmMutation.mutateAsync({
                  ...input,
                  contentType: input.contentType as MaterialContentType,
                })
              }
              onUploaded={(uploaded) =>
                setForm((current) => ({
                  ...current,
                  newUpload: {
                    key: uploaded.key,
                    filename: uploaded.filename,
                    contentType: uploaded.contentType,
                    sizeBytes: uploaded.sizeBytes,
                  },
                }))
              }
              existingPreviewUrl={detailQuery.data?.downloadUrl ?? null}
              existingFilename={detailQuery.data?.filename ?? null}
              existingContentType={detailQuery.data?.contentType ?? null}
            />
          </Stack>

          <FormControlLabel
            control={
              <Switch
                checked={form.published}
                onChange={(e) => setField("published", e.target.checked)}
              />
            }
            label={dictionary.form.fields.published}
          />

          {hasError ? <Alert severity="error">{errorLabel}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{dictionary.form.actions.cancel}</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!canSave}
          startIcon={isSaving ? <CircularProgress size={16} /> : null}
        >
          {dictionary.form.actions.save}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
