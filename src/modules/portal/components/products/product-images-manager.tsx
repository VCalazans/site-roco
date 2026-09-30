"use client";

import { useState, type ChangeEvent } from "react";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/core/trpc-client";
import type { Locale } from "@/i18n/config";
import { productImageDownloadHref, siteCoverId } from "@/modules/portal/lib/product-images";
import type { ProductImage } from "@/modules/portal/lib/product-types";
import type { PortalDictionary } from "@/modules/portal/lib/types";
import { uploadFileDirect } from "@/modules/portal/lib/upload-file";
import { ActionIconButton } from "../shared/action-icon-button";
import { ProductImageTile } from "./product-image-tile";

/** Espelha `ALLOWED_IMAGE_TYPES` de `src/server/trpc/routers/products.ts`. */
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

function isAllowedImageType(value: string): value is AllowedImageType {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(value);
}

type PendingImage = {
  key: string;
  file: File;
  /** Já validado contra `AllowedImageType` na seleção (`handleSelectFiles`). */
  contentType: AllowedImageType;
  alt: string;
  showOnSite: boolean;
};

type ProductImagesManagerProps = {
  productId: string;
  /** Na ordem de exibição (`products.byId`). */
  images: ProductImage[];
  dictionary: PortalDictionary["products"]["form"]["images"];
  saveLabel: string;
  removeLabel: string;
  locale: Locale;
  /** Gates de UI — o servidor confere de novo (`permissionProcedure`). */
  canUpload: boolean;
  /** `product_images:update`: exibir no site e escolher a capa. */
  canUpdate: boolean;
  canDelete: boolean;
  /** `product_images:download`: baixar o arquivo original. */
  canDownload: boolean;
  onImagesChanged: () => void;
  /** O diálogo do produto já abre a seção com o título "Imagens": evita o cabeçalho duplicado. */
  hideTitle?: boolean;
};

/**
 * Imagens do produto no cadastro: fila de upload + grade das enviadas.
 *
 * Cada imagem é marcada para aparecer no site ou ficar só no portal (os
 * representantes baixam TODAS, sem perda de qualidade). A capa da listagem é
 * a primeira visível; "Usar como capa" a leva para o início. As alterações
 * valem na hora — como o envio e a remoção, não esperam o "Salvar" do produto.
 *
 * Upload: seleciona arquivo(s) → fila local com descrição e "Exibir no site"
 * editáveis ANTES do envio → o botão dispara `presignImageUpload → PUT →
 * confirmImageUpload` para cada item.
 */
export function ProductImagesManager({
  productId,
  images,
  dictionary,
  saveLabel,
  removeLabel,
  locale,
  canUpload,
  canUpdate,
  canDelete,
  canDownload,
  onImagesChanged,
  hideTitle = false,
}: ProductImagesManagerProps) {
  const trpc = useTRPC();
  const [pending, setPending] = useState<PendingImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busyImageId, setBusyImageId] = useState<string | null>(null);

  const presignMutation = useMutation(trpc.products.presignImageUpload.mutationOptions());
  const confirmMutation = useMutation(trpc.products.confirmImageUpload.mutationOptions());
  const deleteMutation = useMutation(trpc.products.deleteImage.mutationOptions());
  const visibilityMutation = useMutation(trpc.products.setImageVisibility.mutationOptions());
  const coverMutation = useMutation(trpc.products.setCoverImage.mutationOptions());

  const coverId = siteCoverId(images);

  function handleSelectFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    event.target.value = "";
    if (!files || files.length === 0) return;

    const accepted: PendingImage[] = Array.from(files)
      .filter((file) => isAllowedImageType(file.type))
      .map((file) => ({
        key: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        file,
        contentType: file.type as AllowedImageType,
        alt: "",
        showOnSite: true,
      }));
    if (accepted.length === 0) {
      setError(dictionary.uploadError);
      return;
    }
    setError(null);
    setPending((current) => [...current, ...accepted]);
  }

  function updatePending(key: string, patch: Partial<Pick<PendingImage, "alt" | "showOnSite">>) {
    setPending((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  async function handleUploadAll() {
    if (pending.length === 0) return;
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
          showOnSite: item.showOnSite,
        });
      }
      setPending([]);
    } catch {
      setError(dictionary.uploadError);
    } finally {
      setUploading(false);
      onImagesChanged();
    }
  }

  /** Uma ação por imagem de cada vez: evita clique duplo e mostra qual está sendo alterada. */
  async function runImageAction(imageId: string, action: () => Promise<unknown>) {
    if (busyImageId) return;
    setError(null);
    setBusyImageId(imageId);
    try {
      await action();
      onImagesChanged();
    } catch {
      setError(dictionary.updateError);
    } finally {
      setBusyImageId(null);
    }
  }

  return (
    <Stack spacing={2}>
      {hideTitle ? null : <Typography variant="subtitle1">{dictionary.title}</Typography>}

      {canUpload ? (
        <Paper
          variant="outlined"
          component="label"
          sx={{ p: 3, textAlign: "center", cursor: "pointer", borderStyle: "dashed", display: "block" }}
        >
          <input type="file" hidden multiple accept={ALLOWED_IMAGE_TYPES.join(",")} onChange={handleSelectFiles} />
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
            <Stack
              key={item.key}
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              sx={{ alignItems: { sm: "center" } }}
            >
              <Typography variant="body2" sx={{ minWidth: 140, wordBreak: "break-all" }}>
                {item.file.name}
              </Typography>
              <TextField
                size="small"
                fullWidth
                label={dictionary.altText}
                value={item.alt}
                onChange={(event) => updatePending(item.key, { alt: event.target.value })}
                // O gerenciador vive DENTRO do <form> do diálogo do produto: sem
                // isto, o Enter ao descrever a foto salvaria o produto inteiro.
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.preventDefault();
                }}
              />
              {canUpdate ? (
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={item.showOnSite}
                      onChange={(event) => updatePending(item.key, { showOnSite: event.target.checked })}
                    />
                  }
                  label={dictionary.showOnSite}
                  sx={{ flexShrink: 0, mr: 0 }}
                />
              ) : null}
              <IconButton
                size="small"
                aria-label={`${removeLabel}: ${item.file.name}`}
                onClick={() => setPending((current) => current.filter((pendingItem) => pendingItem.key !== item.key))}
                sx={{ alignSelf: { xs: "flex-end", sm: "center" } }}
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

      {images.length > 0 && !coverId ? <Alert severity="warning">{dictionary.noSiteImages}</Alert> : null}

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 2 }}>
        {images.map((image) => {
          const busy = busyImageId === image.id;
          const isCover = image.id === coverId;
          return (
            <ProductImageTile
              key={image.id}
              image={image}
              isCover={isCover}
              locale={locale}
              labels={dictionary}
              actions={
                <>
                  {canUpdate && !isCover ? (
                    <ActionIconButton
                      label={dictionary.setCover}
                      ariaLabel={`${dictionary.setCover}: ${image.filename}`}
                      icon={<StarBorderIcon fontSize="small" />}
                      disabled={busy}
                      onClick={() =>
                        void runImageAction(image.id, () => coverMutation.mutateAsync({ imageId: image.id }))
                      }
                    />
                  ) : null}
                  {canDownload ? (
                    <ActionIconButton
                      label={dictionary.download}
                      ariaLabel={`${dictionary.download}: ${image.filename}`}
                      icon={<DownloadIcon fontSize="small" />}
                      href={productImageDownloadHref(image.id)}
                    />
                  ) : null}
                  {canDelete ? (
                    <ActionIconButton
                      label={removeLabel}
                      ariaLabel={`${removeLabel}: ${image.filename}`}
                      icon={<DeleteIcon fontSize="small" />}
                      color="error"
                      disabled={busy}
                      onClick={() =>
                        void runImageAction(image.id, () => deleteMutation.mutateAsync({ imageId: image.id }))
                      }
                    />
                  ) : null}
                </>
              }
            >
              {canUpdate ? (
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={image.showOnSite}
                      disabled={busy}
                      onChange={(event) =>
                        void runImageAction(image.id, () =>
                          visibilityMutation.mutateAsync({ imageId: image.id, showOnSite: event.target.checked })
                        )
                      }
                    />
                  }
                  label={dictionary.showOnSite}
                  slotProps={{ typography: { variant: "body2" } }}
                  sx={{ ml: 0 }}
                />
              ) : null}
            </ProductImageTile>
          );
        })}
      </Box>
    </Stack>
  );
}
