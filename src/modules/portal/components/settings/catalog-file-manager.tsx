"use client";

import { useState } from "react";
import DownloadIcon from "@mui/icons-material/Download";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CATALOG_DOWNLOAD_PATH, catalogPath } from "@/core/config/site";
import { useTRPC } from "@/core/trpc-client";
import { PortalFileUploader } from "@/modules/portal/components/shared/portal-file-uploader";
import type { PortalSettingsDictionary } from "@/modules/portal/lib/types";
import { formatFileSize } from "@/shared/lib/file-size";
import { interpolate } from "@/shared/lib/interpolate";
import { getAllowedContentTypes, getMaxBytes } from "@/shared/lib/upload-limits";

const PDF_TYPES = getAllowedContentTypes("catalogPdf");
const MAX_BYTES = getMaxBytes("catalogPdf", PDF_TYPES[0]) ?? 0;

type CatalogFileManagerProps = {
  block: PortalSettingsDictionary["blocks"]["catalog"];
  copy: PortalSettingsDictionary["catalogFile"];
  locale: string;
};

/**
 * Catálogo em PDF baixado por quem preenche o formulário de `/catalogo`. O
 * arquivo enviado vale na hora (o servidor grava no `confirm`), então não há
 * botão de salvar. Para trocar, basta enviar outro.
 */
export function CatalogFileManager({ block, copy, locale }: CatalogFileManagerProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const fileQuery = useQuery(trpc.siteSettings.catalogFile.queryOptions());
  const presign = useMutation(trpc.siteSettings.presignCatalogFile.mutationOptions());
  const confirm = useMutation(trpc.siteSettings.confirmCatalogFile.mutationOptions());
  // Trocar a `key` devolve o uploader ao estado inicial depois de cada envio.
  const [uploadCount, setUploadCount] = useState(0);

  const file = fileQuery.data;
  const dateLocale = locale === "en" ? "en-US" : "pt-BR";
  const maxSize = formatFileSize(MAX_BYTES, dateLocale);

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
      <Stack spacing={2.5}>
        <Box>
          <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 600 }}>
            {block.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {block.description}
          </Typography>
        </Box>

        {fileQuery.isLoading ? (
          <Skeleton variant="rounded" height={72} />
        ) : fileQuery.isError ? (
          <Alert severity="error">{copy.loadFailed}</Alert>
        ) : (
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {file ? copy.currentTitle : copy.defaultTitle}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ wordBreak: "break-all" }}>
              {file
                ? interpolate(copy.currentDetail, {
                    filename: file.filename,
                    size: formatFileSize(file.sizeBytes, dateLocale),
                    date: new Date(file.updatedAt).toLocaleDateString(dateLocale, {
                      timeZone: "America/Sao_Paulo",
                    }),
                  })
                : copy.defaultDetail}
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1, flexWrap: "wrap" }}>
              <Button size="small" href={CATALOG_DOWNLOAD_PATH} startIcon={<DownloadIcon fontSize="small" />}>
                {copy.download}
              </Button>
              <Button
                size="small"
                href={catalogPath(locale)}
                target="_blank"
                rel="noopener noreferrer"
                startIcon={<OpenInNewIcon fontSize="small" />}
              >
                {copy.viewPage}
              </Button>
            </Stack>
          </Box>
        )}

        {uploadCount > 0 ? <Alert severity="success">{copy.saved}</Alert> : null}

        <PortalFileUploader
          key={uploadCount}
          labels={{
            dropzone: file ? copy.dropzoneReplace : copy.dropzone,
            accepted: copy.accepted,
            maxSize: interpolate(copy.maxSize, { size: maxSize }),
            remove: copy.remove,
            replace: copy.replace,
            uploading: copy.uploading,
            uploadError: copy.uploadError,
            errorType: copy.errorType,
            errorSize: interpolate(copy.errorSize, { size: maxSize }),
          }}
          acceptedTypes={PDF_TYPES}
          maxSizeBytesFor={() => MAX_BYTES}
          presign={(input) => presign.mutateAsync(input)}
          confirm={(input) => confirm.mutateAsync(input)}
          onUploaded={() => {
            setUploadCount((count) => count + 1);
            void queryClient.invalidateQueries(trpc.siteSettings.catalogFile.queryFilter());
          }}
        />
      </Stack>
    </Paper>
  );
}
