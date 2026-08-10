"use client";

import { useState, type ChangeEvent } from "react";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/core/trpc-client";
import type { RepresentativeDocument } from "@/modules/portal/lib/onboarding-types";
import type { PortalDictionary } from "@/modules/portal/lib/types";
import { uploadFileDirect } from "@/modules/portal/lib/upload-file";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
/** Espelha `ALLOWED_DOCUMENT_TYPES` de `src/server/trpc/routers/representatives.ts`. */
const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;
type AcceptedDocumentType = (typeof ACCEPTED_TYPES)[number];

function isAcceptedDocumentType(value: string): value is AcceptedDocumentType {
  return (ACCEPTED_TYPES as readonly string[]).includes(value);
}

type DocumentsStepProps = {
  dictionary: PortalDictionary["onboarding"];
  /** Reaproveitado de `portal.products.form.images.uploadError` — o
   *  dicionário não tem uma mensagem genérica de erro de upload dentro de
   *  `onboarding.validation`; ver relatório final. */
  uploadErrorLabel: string;
  loadingLabel: string;
  documents: RepresentativeDocument[];
};

/**
 * Passo 4: upload multi-arquivo (presign → PUT direto → confirm). Sem
 * `deleteDocument` no contrato tRPC combinado (só `presignDocumentUpload` /
 * `confirmDocumentUpload`) — por isso a lista de documentos já confirmados
 * não tem ação de remover (o rótulo `upload.remove` do dicionário fica sem
 * uso nesta tela; ver relatório final).
 */
export function DocumentsStep({
  dictionary,
  uploadErrorLabel,
  loadingLabel,
  documents,
}: DocumentsStepProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [uploadingCount, setUploadingCount] = useState(0);

  const presignMutation = useMutation(
    trpc.representatives.presignDocumentUpload.mutationOptions()
  );
  const confirmMutation = useMutation(
    trpc.representatives.confirmDocumentUpload.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.representatives.me.queryKey(),
        });
      },
    })
  );

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    event.target.value = "";
    if (!files || files.length === 0) {
      return;
    }
    setError(null);

    for (const file of Array.from(files)) {
      if (file.size > MAX_SIZE_BYTES) {
        setError(dictionary.validation.fileTooLarge);
        continue;
      }
      if (!isAcceptedDocumentType(file.type)) {
        setError(uploadErrorLabel);
        continue;
      }

      setUploadingCount((count) => count + 1);
      try {
        const presign = await presignMutation.mutateAsync({
          filename: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        });
        await uploadFileDirect(file, presign);
        await confirmMutation.mutateAsync({
          key: presign.key,
          filename: file.name,
          contentType: file.type,
        });
      } catch {
        setError(uploadErrorLabel);
      } finally {
        setUploadingCount((count) => count - 1);
      }
    }
  }

  return (
    <Stack spacing={2} sx={{ maxWidth: 480 }}>
      <Paper
        variant="outlined"
        component="label"
        sx={{
          p: 4,
          textAlign: "center",
          cursor: "pointer",
          borderStyle: "dashed",
          display: "block",
        }}
      >
        <input
          type="file"
          hidden
          multiple
          accept={ACCEPTED_TYPES.join(",")}
          onChange={handleFiles}
        />
        <CloudUploadIcon fontSize="large" color="action" />
        <Typography sx={{ mt: 1 }}>{dictionary.upload.dropzone}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
          {dictionary.upload.accepted}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
          {dictionary.upload.maxSize}
        </Typography>
      </Paper>

      {uploadingCount > 0 ? (
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">
            {loadingLabel}
          </Typography>
        </Stack>
      ) : null}

      {error ? <Alert severity="error">{error}</Alert> : null}

      <List disablePadding>
        {documents.map((document) => (
          <ListItem key={document.id} disableGutters>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <InsertDriveFileIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={document.filename}
              secondary={`${(document.sizeBytes / 1024).toFixed(0)} KB`}
            />
          </ListItem>
        ))}
      </List>
    </Stack>
  );
}
