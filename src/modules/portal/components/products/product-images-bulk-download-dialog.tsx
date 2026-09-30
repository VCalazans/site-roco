"use client";

import FolderZipOutlinedIcon from "@mui/icons-material/FolderZipOutlined";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/core/trpc-client";
import type { Locale } from "@/i18n/config";
import {
  hasActiveProductFilters,
  toProductListInput,
  type ProductFilters,
} from "@/modules/portal/lib/product-filters";
import {
  exceedsZipLimits,
  filteredImagesZipHref,
  IMAGES_ZIP_MAX_BYTES,
  IMAGES_ZIP_MAX_FILES,
} from "@/modules/portal/lib/product-images";
import type { PortalDictionary } from "@/modules/portal/lib/types";
import { formatFileSize } from "@/shared/lib/file-size";
import { interpolate } from "@/shared/lib/interpolate";

type ProductImagesBulkDownloadDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Os filtros da tabela: o ZIP leva exatamente estes produtos. */
  filters: ProductFilters;
  dictionary: PortalDictionary["products"];
  cancelLabel: string;
  errorLabel: string;
  locale: Locale;
  /** O download começou (o navegador assume a partir daqui). */
  onStarted: () => void;
};

/**
 * Confirmação do download em lote: mostra o tamanho ANTES de começar (quantos
 * produtos, quantas imagens, quantos MB) e barra o que passa do limite do ZIP.
 * O botão é um link para a rota do ZIP com os mesmos filtros da tabela — sem
 * filtro, o catálogo inteiro.
 */
export function ProductImagesBulkDownloadDialog({
  open,
  onClose,
  filters,
  dictionary,
  cancelLabel,
  errorLabel,
  locale,
  onStarted,
}: ProductImagesBulkDownloadDialogProps) {
  const trpc = useTRPC();
  const labels = dictionary.bulkDownload;
  const summaryQuery = useQuery(
    trpc.products.imagesSummary.queryOptions(toProductListInput(filters), { enabled: open })
  );
  const summary = summaryQuery.data;
  const numbers = new Intl.NumberFormat(locale);

  const isEmpty = summary !== undefined && summary.imageCount === 0;
  const tooLarge = summary !== undefined && exceedsZipLimits(summary);
  const canDownload = summary !== undefined && !isEmpty && !tooLarge;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{labels.title}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            {hasActiveProductFilters(filters) ? labels.scopeFiltered : labels.scopeAll}
          </Typography>

          {summaryQuery.isLoading ? <Skeleton variant="text" width="70%" /> : null}
          {summaryQuery.isError ? <Alert severity="error">{errorLabel}</Alert> : null}

          {summary && !isEmpty ? (
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }} aria-live="polite">
              {interpolate(labels.summary, {
                images: interpolate(summary.imageCount === 1 ? labels.imagesCount.one : labels.imagesCount.other, {
                  count: numbers.format(summary.imageCount),
                }),
                products: interpolate(
                  summary.productCount === 1 ? labels.productsCount.one : labels.productsCount.other,
                  { count: numbers.format(summary.productCount) }
                ),
                size: formatFileSize(summary.totalBytes, locale),
              })}
            </Typography>
          ) : null}

          {isEmpty ? <Alert severity="info">{labels.empty}</Alert> : null}
          {tooLarge ? (
            <Alert severity="warning">
              {interpolate(labels.tooLarge, {
                files: numbers.format(IMAGES_ZIP_MAX_FILES),
                size: formatFileSize(IMAGES_ZIP_MAX_BYTES, locale),
              })}
            </Alert>
          ) : null}

          <Typography variant="body2" color="text.secondary">
            {labels.hint}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{cancelLabel}</Button>
        <Button
          variant="contained"
          component="a"
          href={filteredImagesZipHref(filters)}
          startIcon={<FolderZipOutlinedIcon />}
          disabled={!canDownload}
          onClick={() => {
            onStarted();
            onClose();
          }}
        >
          {labels.confirm}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
