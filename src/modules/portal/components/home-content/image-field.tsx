"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import FormHelperText from "@mui/material/FormHelperText";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/core/trpc-client";
import { PortalFileUploader } from "@/modules/portal/components/shared/portal-file-uploader";
import type { PortalHomeContentDictionary } from "@/modules/portal/lib/home-content-dictionary";
import { interpolate } from "@/shared/lib/interpolate";
import { getAllowedContentTypes, getExtension, getMaxBytes } from "@/shared/lib/upload-limits";
import { resolveImagePreview } from "./home-editor-model";

/**
 * Tipos, teto e rótulos DERIVADOS da tabela central de uploads
 * (`@/shared/lib/upload-limits`, campo `siteImage`) — a mesma que o servidor
 * usa em `homeContent.presignImage`, então tela e servidor nunca divergem
 * (mesmo cuidado de `material-form-dialog.tsx`).
 */
const IMAGE_TYPES = getAllowedContentTypes("siteImage");
const IMAGE_FORMATS_LABEL = [
  ...new Set(
    IMAGE_TYPES.map((type) => getExtension("siteImage", type)).filter((extension): extension is string =>
      Boolean(extension)
    )
  ),
]
  .join(", ")
  .toUpperCase();
const IMAGE_MAX_LABEL = `${Math.round(
  Math.max(...IMAGE_TYPES.map((type) => getMaxBytes("siteImage", type) ?? 0)) / (1024 * 1024)
)} MB`;

type ImageFieldProps = {
  dictionary: PortalHomeContentDictionary["image"];
  /** Chave R2 da imagem enviada pelo painel (`null` = sem imagem própria). */
  imageKey: string | null;
  /** Arte padrão de `public/` usada quando não há imagem enviada. */
  defaultPath: string | null;
  /** Chave R2 → URL pública (imagens salvas + as enviadas nesta sessão). */
  imageUrls: Readonly<Record<string, string>>;
  /** `null` = voltar à arte padrão. */
  onChange: (imageKey: string | null) => void;
  /** Avisa a URL pública de uma imagem recém-enviada (para pré-visualizar antes de salvar). */
  onImageUrl: (key: string, url: string) => void;
  /** Sem permissão de edição: só a pré-visualização, sem envio. */
  readOnly: boolean;
  /** Salvando: o envio continua na tela, mas inerte (não some, para não piscar). */
  disabled: boolean;
  helper?: string;
  error?: string;
};

/**
 * Imagem editável: pré-visualização do que o site mostra HOJE (a enviada ou a
 * arte padrão) + envio em 3 passos (presign → PUT no R2 → confirm) pelo
 * `PortalFileUploader`. A chave só entra no formulário depois do confirm — é
 * o que o servidor exige para aceitar a imagem no `update`.
 *
 * O `existingPreviewUrl` do uploader é sempre derivado do estado do
 * formulário (não do que o uploader guarda): assim, ao trocar de seção e
 * voltar, a imagem enviada e ainda não salva continua aparecendo.
 */
export function ImageField({
  dictionary,
  imageKey,
  defaultPath,
  imageUrls,
  onChange,
  onImageUrl,
  readOnly,
  disabled,
  helper,
  error,
}: ImageFieldProps) {
  const trpc = useTRPC();
  const presignMutation = useMutation(trpc.homeContent.presignImage.mutationOptions());
  const confirmMutation = useMutation(trpc.homeContent.confirmImage.mutationOptions());

  const preview = resolveImagePreview({ imageKey, defaultPath, imageUrls });

  return (
    <Stack spacing={1.5} sx={{ maxWidth: 520 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
        <Chip
          size="small"
          variant="outlined"
          color={preview.kind === "custom" ? "primary" : "default"}
          label={preview.kind === "custom" ? dictionary.customBadge : dictionary.defaultBadge}
        />
        {preview.kind === "custom" && defaultPath && !readOnly ? (
          <Button size="small" disabled={disabled} onClick={() => onChange(null)}>
            {dictionary.useDefault}
          </Button>
        ) : null}
      </Stack>

      {readOnly ? (
        preview.url ? (
          <Box sx={{ borderRadius: 1, overflow: "hidden", border: 1, borderColor: "divider", maxHeight: 240 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- pré-visualização de URL do R2 fora dos `remotePatterns` (mesmo padrão de portal-file-uploader.tsx) */}
            <img src={preview.url} alt="" style={{ display: "block", width: "100%", maxHeight: 240, objectFit: "contain" }} />
          </Box>
        ) : null
      ) : (
        // `inert` (React 19): enquanto salva, o envio fica na tela mas não responde a
        // clique nem foco — desmontar o uploader faria a pré-visualização piscar.
        <Box inert={disabled} sx={{ opacity: disabled ? 0.6 : 1 }}>
          <PortalFileUploader
            labels={{
              dropzone: dictionary.dropzone,
              // Vazios de propósito: o uploader só mostra estas duas linhas no modo "dropzone",
              // e some com elas quando já há imagem. A dica abaixo fica sempre visível.
              maxSize: "",
              accepted: "",
              errorType: interpolate(dictionary.errorType, { formats: IMAGE_FORMATS_LABEL }),
              errorSize: interpolate(dictionary.errorSize, { size: IMAGE_MAX_LABEL }),
              remove: dictionary.remove,
              replace: dictionary.replace,
              uploading: dictionary.uploading,
              uploadError: dictionary.uploadError,
            }}
            acceptedTypes={IMAGE_TYPES}
            maxSizeBytesFor={(contentType) => getMaxBytes("siteImage", contentType) ?? 0}
            presign={(input) => presignMutation.mutateAsync(input)}
            confirm={async (input) => {
              const result = await confirmMutation.mutateAsync(input);
              if (result.url) onImageUrl(result.key, result.url);
              return result;
            }}
            onUploaded={(uploaded) => onChange(uploaded.key)}
            existingPreviewUrl={preview.url}
            existingKind="image"
          />
        </Box>
      )}

      {preview.kind === "custom" && !preview.url ? (
        <Typography variant="caption" color="text.secondary">
          {dictionary.previewUnavailable}
        </Typography>
      ) : null}
      {!readOnly ? (
        <FormHelperText>
          {interpolate(dictionary.accepted, { formats: IMAGE_FORMATS_LABEL })} ·{" "}
          {interpolate(dictionary.maxSize, { size: IMAGE_MAX_LABEL })}
        </FormHelperText>
      ) : null}
      {error ? <FormHelperText error>{error}</FormHelperText> : null}
      {helper ? <FormHelperText>{helper}</FormHelperText> : null}
    </Stack>
  );
}
