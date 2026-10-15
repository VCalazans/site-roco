"use client";

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
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
  /** `URL.createObjectURL` do arquivo: miniatura na hora, sem esperar o servidor. */
  previewUrl: string;
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
  const [dragging, setDragging] = useState(false);
  /** Imagens já confirmadas que a lista do servidor ainda não trouxe (feedback imediato). */
  const [justUploaded, setJustUploaded] = useState<ProductImage[]>([]);
  /** Excluídas aqui: somem no clique, antes da lista do servidor voltar. */
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  /** Prévia local por id de imagem: o tile não baixa o original recém-enviado. */
  const [localPreviews, setLocalPreviews] = useState<Record<string, string>>({});
  const objectUrls = useRef<string[]>([]);

  // Libera as prévias locais quando o gerenciador sai da tela.
  useEffect(() => {
    const urls = objectUrls.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, []);

  const presignMutation = useMutation(trpc.products.presignImageUpload.mutationOptions());
  const confirmMutation = useMutation(trpc.products.confirmImageUpload.mutationOptions());
  const deleteMutation = useMutation(trpc.products.deleteImage.mutationOptions());
  const visibilityMutation = useMutation(trpc.products.setImageVisibility.mutationOptions());
  const coverMutation = useMutation(trpc.products.setCoverImage.mutationOptions());

  // Lista exibida = servidor + recém-enviadas que ele ainda não trouxe − excluídas aqui.
  const serverIds = new Set(images.map((image) => image.id));
  const shownImages = [
    ...images,
    ...justUploaded.filter((image) => !serverIds.has(image.id)),
  ].filter((image) => !removedIds.includes(image.id));
  const coverId = siteCoverId(shownImages);

  function addFiles(files: File[]) {
    if (files.length === 0) return;

    const accepted: PendingImage[] = files
      .filter((file) => isAllowedImageType(file.type))
      .map((file) => {
        const previewUrl = URL.createObjectURL(file);
        objectUrls.current.push(previewUrl);
        return {
          key: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
          file,
          contentType: file.type as AllowedImageType,
          alt: "",
          showOnSite: true,
          previewUrl,
        };
      });
    if (accepted.length === 0) {
      setError(dictionary.uploadError);
      return;
    }
    setError(null);
    setPending((current) => [...current, ...accepted]);
  }

  function handleSelectFiles(event: ChangeEvent<HTMLInputElement>) {
    // Copia ANTES de limpar o input: no Chrome o `FileList` é esvaziado no
    // lugar por `value = ""`, e a seleção chegava aqui vazia (nada entrava na fila).
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    addFiles(files);
  }

  /** "Arraste fotos aqui": sem isto, soltar o arquivo não entrava na fila. */
  function handleDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    if (!dragging) setDragging(true);
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragging(false);
    addFiles(Array.from(event.dataTransfer.files ?? []));
  }

  function updatePending(key: string, patch: Partial<Pick<PendingImage, "alt" | "showOnSite">>) {
    setPending((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  async function handleUploadAll() {
    if (pending.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      // Um item por vez: assim que o servidor confirma, ele sai da fila e
      // entra no grid com a prévia local — sem esperar os demais nem a recarga.
      for (const item of pending) {
        const presign = await presignMutation.mutateAsync({
          productId,
          filename: item.file.name,
          contentType: item.contentType,
          sizeBytes: item.file.size,
        });
        await uploadFileDirect(item.file, presign);
        const image = await confirmMutation.mutateAsync({
          productId,
          key: presign.key,
          filename: item.file.name,
          contentType: item.contentType,
          altPt: item.alt || undefined,
          showOnSite: item.showOnSite,
        });
        setLocalPreviews((current) => ({ ...current, [image.id]: item.previewUrl }));
        setJustUploaded((current) => [
          ...current,
          {
            id: image.id,
            url: image.url,
            filename: image.filename,
            contentType: image.contentType,
            sizeBytes: image.sizeBytes,
            altPt: image.altPt,
            showOnSite: image.showOnSite,
          },
        ]);
        setPending((current) => current.filter((pendingItem) => pendingItem.key !== item.key));
        onImagesChanged();
      }
    } catch {
      setError(dictionary.uploadError);
    } finally {
      setUploading(false);
    }
  }

  /** Uma ação por imagem de cada vez: evita clique duplo e mostra qual está sendo alterada. */
  async function runImageAction(
    imageId: string,
    action: () => Promise<unknown>,
    options: { removes?: boolean } = {}
  ) {
    if (busyImageId) return;
    setError(null);
    setBusyImageId(imageId);
    // Exclusão some no clique; volta se o servidor recusar.
    if (options.removes) setRemovedIds((current) => [...current, imageId]);
    try {
      await action();
      onImagesChanged();
    } catch {
      if (options.removes) setRemovedIds((current) => current.filter((id) => id !== imageId));
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
          onDragOver={handleDragOver}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          sx={{
            p: 3,
            textAlign: "center",
            cursor: "pointer",
            borderStyle: "dashed",
            display: "block",
            borderColor: dragging ? "primary.main" : undefined,
            bgcolor: dragging ? "action.hover" : undefined,
          }}
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
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 180 }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:) do arquivo escolhido */}
                <img
                  src={item.previewUrl}
                  alt=""
                  width={48}
                  height={48}
                  style={{ objectFit: "cover", borderRadius: 4, flexShrink: 0 }}
                />
                <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
                  {item.file.name}
                </Typography>
              </Stack>
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

      {shownImages.length > 0 && !coverId ? <Alert severity="warning">{dictionary.noSiteImages}</Alert> : null}

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 2 }}>
        {shownImages.map((image) => {
          const busy = busyImageId === image.id;
          const isCover = image.id === coverId;
          return (
            <ProductImageTile
              key={image.id}
              image={image}
              previewUrl={localPreviews[image.id]}
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
                        void runImageAction(image.id, () => deleteMutation.mutateAsync({ imageId: image.id }), {
                          removes: true,
                        })
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
