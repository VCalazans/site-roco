"use client";

import { useState, type ChangeEvent } from "react";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/core/trpc-client";
import type { ProductImage } from "@/modules/portal/lib/product-types";
import type { PortalDictionary } from "@/modules/portal/lib/types";
import { uploadFileDirect } from "@/modules/portal/lib/upload-file";

type PendingImage = {
  key: string;
  file: File;
  /** Já validado contra `AllowedImageType` na seleção (`handleSelectFiles`). */
  contentType: AllowedImageType;
  alt: string;
};

/** Espelha `ALLOWED_IMAGE_TYPES` de `src/server/trpc/routers/products.ts`. */
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

function isAllowedImageType(value: string): value is AllowedImageType {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(value);
}

type ProductImagesManagerProps = {
  productId: string;
  images: ProductImage[];
  dictionary: PortalDictionary["products"]["form"]["images"];
  saveLabel: string;
  removeLabel: string;
  /** Gate de UI para `product_images:create`/`product_images:delete` — ver
   *  `permissions.ts`; distinto de `products:update` no contrato. */
  canUpload: boolean;
  canDelete: boolean;
  onImagesChanged: () => void;
};

/**
 * Grid de imagens do produto + fila de upload. Fluxo: seleciona arquivo(s) →
 * entram numa fila local (`PendingImage[]`) com campo de `alt` editável
 * ANTES do envio (o contrato só aceita `altPt` no momento de
 * `confirmImageUpload`, não há endpoint de update posterior) → botão
 * "{saveLabel}" dispara `presignImageUpload → PUT → confirmImageUpload` em
 * sequência para cada item da fila.
 */
export function ProductImagesManager({
  productId,
  images,
  dictionary,
  saveLabel,
  removeLabel,
  canUpload,
  canDelete,
  onImagesChanged,
}: ProductImagesManagerProps) {
  const trpc = useTRPC();
  const [pending, setPending] = useState<PendingImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const presignMutation = useMutation(trpc.products.presignImageUpload.mutationOptions());
  const confirmMutation = useMutation(
    trpc.products.confirmImageUpload.mutationOptions({
      onSuccess: onImagesChanged,
    })
  );
  const deleteMutation = useMutation(
    trpc.products.deleteImage.mutationOptions({
      onSuccess: onImagesChanged,
    })
  );

  function handleSelectFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    event.target.value = "";
    if (!files || files.length === 0) {
      return;
    }
    const accepted: PendingImage[] = [];
    for (const file of Array.from(files)) {
      if (isAllowedImageType(file.type)) {
        accepted.push({
          key: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
          file,
          contentType: file.type,
          alt: "",
        });
      }
    }
    if (accepted.length === 0) {
      setError(dictionary.uploadError);
      return;
    }
    setError(null);
    setPending((current) => [...current, ...accepted]);
  }

  function removePending(key: string) {
    setPending((current) => current.filter((item) => item.key !== key));
  }

  function updatePendingAlt(key: string, alt: string) {
    setPending((current) => current.map((item) => (item.key === key ? { ...item, alt } : item)));
  }

  async function handleUploadAll() {
    if (pending.length === 0) {
      return;
    }
    setError(null);
    setUploading(true);
    try {
      for (const item of pending) {
        const presign = await presignMutation.mutateAsync({
          productId,
          filename: item.file.name,
          contentType: item.contentType,
          sizeBytes: item.file.size,
        });
        await uploadFileDirect(item.file, presign);
        await confirmMutation.mutateAsync({
          productId,
          key: presign.key,
          filename: item.file.name,
          contentType: item.contentType,
          altPt: item.alt || undefined,
        });
      }
      setPending([]);
    } catch {
      setError(dictionary.uploadError);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1">{dictionary.title}</Typography>

      {canUpload ? (
        <Paper
          variant="outlined"
          component="label"
          sx={{ p: 3, textAlign: "center", cursor: "pointer", borderStyle: "dashed", display: "block" }}
        >
          <input
            type="file"
            hidden
            multiple
            accept={ALLOWED_IMAGE_TYPES.join(",")}
            onChange={handleSelectFiles}
          />
          <AddPhotoAlternateIcon color="action" />
          <Typography variant="body2" sx={{ mt: 1 }}>
            {dictionary.dropzone}
          </Typography>
        </Paper>
      ) : null}

      {error ? <Alert severity="error">{error}</Alert> : null}

      {pending.length > 0 ? (
        <Stack spacing={1.5}>
          {pending.map((item) => (
            <Stack key={item.key} direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <Typography variant="body2" sx={{ minWidth: 140, wordBreak: "break-all" }}>
                {item.file.name}
              </Typography>
              <TextField
                size="small"
                fullWidth
                label={dictionary.altText}
                value={item.alt}
                onChange={(event) => updatePendingAlt(item.key, event.target.value)}
              />
              <IconButton
                size="small"
                aria-label={removeLabel}
                onClick={() => removePending(item.key)}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
          <Box>
            <Button
              variant="contained"
              size="small"
              onClick={handleUploadAll}
              disabled={uploading}
              startIcon={uploading ? <CircularProgress size={16} /> : null}
            >
              {saveLabel}
            </Button>
          </Box>
        </Stack>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
          gap: 2,
        }}
      >
        {images.map((image) => (
          <Paper key={image.id} variant="outlined" sx={{ p: 1 }}>
            <Box sx={{ position: "relative", width: "100%", aspectRatio: "1", overflow: "hidden", borderRadius: 1 }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- thumbnails vêm do domínio do R2, fora dos `remotePatterns` do next.config.ts (não editado nesta onda) */}
              <img
                src={image.url}
                alt={image.altPt ?? ""}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </Box>
            <Typography
              variant="caption"
              color="text.secondary"
              noWrap
              sx={{ display: "block", mt: 0.5 }}
            >
              {image.altPt || image.filename}
            </Typography>
            {canDelete ? (
              <IconButton
                size="small"
                aria-label={removeLabel}
                onClick={() => deleteMutation.mutate({ imageId: image.id })}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            ) : null}
          </Paper>
        ))}
      </Box>
    </Stack>
  );
}
