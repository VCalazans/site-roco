"use client";

import { useRef, useState, type ChangeEvent } from "react";
import CloseIcon from "@mui/icons-material/Close";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { uploadFileDirect, type PresignedUpload } from "@/modules/portal/lib/upload-file";

export type PortalFileUploaderLabels = {
  dropzone: string;
  /** Já formatado pelo chamador (ex.: via `interpolate`) — "Tamanho máximo: 200 MB". */
  maxSize: string;
  /** Já formatado pelo chamador — "Formatos aceitos: MP4, WebM". */
  accepted: string;
  remove: string;
  replace: string;
  uploading: string;
  /** Falha de rede/servidor — o caso em que não sabemos qual regra quebrou. */
  uploadError: string;
  /**
   * Rótulos específicos de REJEIÇÃO, opcionais.
   *
   * As três causas possíveis — formato não aceito, arquivo acima do teto e
   * falha de rede — mostravam o MESMO texto genérico, e a pessoa não tinha
   * como saber o que corrigir. Fornecer estes campos faz o componente dizer
   * qual regra quebrou; sem eles o comportamento é o antigo (`uploadError`
   * para tudo), então nada regride enquanto os chamadores não passarem a copy.
   */
  errorType?: string;
  errorSize?: string;
};

export type PortalFileUploaderConfirmedFile = {
  key: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
};

type PortalFileUploaderProps = {
  labels: PortalFileUploaderLabels;
  /** Tipos MIME aceitos — vira o atributo `accept` do input e a validação
   *  client-side de UX. A validação REAL (tipo + tamanho) é sempre no
   *  servidor (`presignUpload`/`confirmUpload`); esta é só uma pré-checagem
   *  para não gastar uma chamada de presign com um arquivo já inválido. */
  acceptedTypes: readonly string[];
  /** Teto de tamanho por `contentType` — alguns campos (ex.: materiais)
   *  aceitam tipos com limites diferentes entre si (documento vs vídeo). */
  maxSizeBytesFor: (contentType: string) => number;
  presign: (input: {
    filename: string;
    contentType: string;
    sizeBytes: number;
  }) => Promise<PresignedUpload>;
  confirm: (input: {
    key: string;
    filename: string;
    contentType: string;
  }) => Promise<{ key: string; sizeBytes: number }>;
  onUploaded: (file: PortalFileUploaderConfirmedFile) => void;
  /** Preview de um registro já salvo (edição) — usado até o usuário
   *  escolher substituir o arquivo. */
  existingPreviewUrl?: string | null;
  existingFilename?: string | null;
  existingContentType?: string | null;
  /** Override explícito de como renderizar o preview de um registro já
   *  salvo, para chamadores que sabem o tipo pelo CONTEXTO do campo (ex.:
   *  o campo de vídeo do hero sempre é vídeo) mas não guardam o
   *  `contentType` exato no registro (`HeroSlide` não tem essa coluna).
   *  Tem prioridade sobre `existingContentType` quando não há arquivo novo
   *  selecionado nesta sessão. */
  existingKind?: "video" | "image" | "file";
};

function previewKind(
  contentType: string | null | undefined,
  fallbackKind: "video" | "image" | "file" | undefined
): "video" | "image" | "file" {
  if (contentType) {
    if (contentType.startsWith("video/")) return "video";
    if (contentType.startsWith("image/")) return "image";
    return "file";
  }
  return fallbackKind ?? "file";
}

function filenameFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    const last = path.split("/").pop() ?? "";
    return decodeURIComponent(last);
  } catch {
    return url;
  }
}

/**
 * Uploader genérico 2-step (presign → PUT direto no R2 → confirm),
 * reutilizado pelo formulário de hero (vídeo e pôster) e pelo formulário de
 * materiais. Não sabe nada sobre o domínio de quem o usa — `presign`/
 * `confirm` são injetados pelo chamador, que decide o que fazer com o
 * resultado via `onUploaded`. Nunca exibe a `key` (R2) bruta ao usuário —
 * só o nome do arquivo.
 */
export function PortalFileUploader({
  labels,
  acceptedTypes,
  maxSizeBytesFor,
  presign,
  confirm,
  onUploaded,
  existingPreviewUrl,
  existingFilename,
  existingContentType,
  existingKind,
}: PortalFileUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [confirmedFilename, setConfirmedFilename] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  function revokeLocalPreview() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }

  async function handleSelect(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected) {
      return;
    }

    setError(null);

    // As duas rejeições abaixo dizem QUAL regra quebrou. `selected.type` pode
    // vir vazio quando o sistema operacional não reconhece a extensão — nesse
    // caso cai em "formato não aceito", que é o diagnóstico correto do ponto
    // de vista de quem está enviando.
    if (!acceptedTypes.includes(selected.type)) {
      setError(labels.errorType ?? labels.uploadError);
      return;
    }
    if (selected.size <= 0 || selected.size > maxSizeBytesFor(selected.type)) {
      setError(labels.errorSize ?? labels.uploadError);
      return;
    }

    revokeLocalPreview();
    const url = URL.createObjectURL(selected);
    objectUrlRef.current = url;
    setFile(selected);
    setLocalPreviewUrl(url);
    setConfirmedFilename(null);
    setUploading(true);
    setProgress(0);

    try {
      const presigned = await presign({
        filename: selected.name,
        contentType: selected.type,
        sizeBytes: selected.size,
      });
      await uploadFileDirect(selected, presigned, (percent) => setProgress(percent));
      const confirmed = await confirm({
        key: presigned.key,
        filename: selected.name,
        contentType: selected.type,
      });
      setConfirmedFilename(selected.name);
      onUploaded({
        key: confirmed.key,
        filename: selected.name,
        contentType: selected.type,
        sizeBytes: confirmed.sizeBytes,
      });
    } catch {
      setError(labels.uploadError);
    } finally {
      setUploading(false);
    }
  }

  function handleRemove() {
    revokeLocalPreview();
    setFile(null);
    setLocalPreviewUrl(null);
    setConfirmedFilename(null);
    setError(null);
  }

  // Um arquivo novo selecionado nesta sessão sempre usa o `contentType`
  // real (`file.type`); sem isso, cai no `existingContentType` do registro
  // salvo (materiais) ou, na ausência dele, no `existingKind` explícito do
  // chamador (hero — `HeroSlide` não guarda o `contentType` original).
  const effectiveContentType = file?.type ?? existingContentType ?? null;
  const previewUrl = localPreviewUrl ?? existingPreviewUrl ?? null;
  const previewFilename =
    file?.name ??
    confirmedFilename ??
    existingFilename ??
    (previewUrl ? filenameFromUrl(previewUrl) : null);
  const hasFile = Boolean(previewUrl || previewFilename);
  const kind = previewKind(effectiveContentType, existingKind);

  return (
    <Stack spacing={1.5}>
      {!hasFile ? (
        <Paper
          variant="outlined"
          component="label"
          sx={{ p: 3, textAlign: "center", cursor: "pointer", borderStyle: "dashed", display: "block" }}
        >
          <input type="file" hidden accept={acceptedTypes.join(",")} onChange={handleSelect} />
          <CloudUploadIcon color="action" />
          <Typography variant="body2" sx={{ mt: 1 }}>
            {labels.dropzone}
          </Typography>
          {/* `accepted`/`maxSize` são opcionais na prática: quando o
              dicionário do chamador não tem um rótulo dedicado para este
              campo específico (ex.: pôster do hero, que não tem seu próprio
              par no dicionário — só o do vídeo), o chamador passa string
              vazia em vez de reaproveitar um texto que citaria números/
              formatos errados. */}
          {labels.accepted ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              {labels.accepted}
            </Typography>
          ) : null}
          {labels.maxSize ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              {labels.maxSize}
            </Typography>
          ) : null}
        </Paper>
      ) : (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            {kind === "video" && previewUrl ? (
              <Box sx={{ width: "100%", maxHeight: 220, overflow: "hidden", borderRadius: 1, bgcolor: "common.black" }}>
                <video src={previewUrl} controls muted style={{ width: "100%", maxHeight: 220 }} />
              </Box>
            ) : null}
            {kind === "image" && previewUrl ? (
              <Box sx={{ width: "100%", maxHeight: 220, overflow: "hidden", borderRadius: 1 }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- preview vem de blob local ou de URL fora dos `remotePatterns` (mesmo padrão de product-images-manager.tsx) */}
                <img src={previewUrl} alt="" style={{ width: "100%", maxHeight: 220, objectFit: "contain" }} />
              </Box>
            ) : null}
            {kind === "file" ? (
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <InsertDriveFileIcon fontSize="small" color="action" />
              </Stack>
            ) : null}

            <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
              <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
                {previewFilename}
              </Typography>
              <IconButton size="small" aria-label={labels.remove} onClick={handleRemove}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>

            {uploading ? (
              <Stack spacing={0.5}>
                <LinearProgress
                  variant={progress > 0 ? "determinate" : "indeterminate"}
                  value={progress}
                />
                <Typography variant="caption" color="text.secondary">
                  {labels.uploading}
                </Typography>
              </Stack>
            ) : (
              <Box>
                <Paper
                  variant="outlined"
                  component="label"
                  sx={{ px: 1.5, py: 0.5, display: "inline-block", cursor: "pointer" }}
                >
                  <input type="file" hidden accept={acceptedTypes.join(",")} onChange={handleSelect} />
                  <Typography variant="caption">{labels.replace}</Typography>
                </Paper>
              </Box>
            )}
          </Stack>
        </Paper>
      )}

      {error ? <Alert severity="error">{error}</Alert> : null}
    </Stack>
  );
}
