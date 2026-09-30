"use client";

import DownloadIcon from "@mui/icons-material/Download";
import FolderZipOutlinedIcon from "@mui/icons-material/FolderZipOutlined";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/core/trpc-client";
import type { Locale } from "@/i18n/config";
import {
  productImageDownloadHref,
  productImagesZipHref,
  siteCoverId,
} from "@/modules/portal/lib/product-images";
import type { ProductListItem } from "@/modules/portal/lib/product-types";
import type { PortalDictionary } from "@/modules/portal/lib/types";
import { interpolate } from "@/shared/lib/interpolate";
import { ActionIconButton } from "../shared/action-icon-button";
import { ProductImageTile } from "./product-image-tile";

type ProductImagesDialogProps = {
  /** Produto aberto; mantido pelo pai até o fim da animação de saída. */
  product: ProductListItem | null;
  open: boolean;
  onClose: () => void;
  onExited: () => void;
  dictionary: PortalDictionary["products"];
  errorLabel: string;
  locale: Locale;
};

const GRID_SX = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 2, mt: 2 };

/**
 * Galeria de download das imagens de um produto — o caminho do representante
 * até as fotos: TODAS as imagens (inclusive as que não aparecem no site), cada
 * uma baixável como arquivo ORIGINAL, mais o ZIP com todas. Os links passam
 * pelas rotas autenticadas, que conferem a permissão no clique.
 */
export function ProductImagesDialog({
  product,
  open,
  onClose,
  onExited,
  dictionary,
  errorLabel,
  locale,
}: ProductImagesDialogProps) {
  const trpc = useTRPC();
  const labels = dictionary.imagesDialog;
  const detailQuery = useQuery(
    trpc.products.byId.queryOptions({ id: product?.id ?? "" }, { enabled: open && product !== null })
  );
  const images = detailQuery.data?.images ?? [];
  const coverId = siteCoverId(images);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" slotProps={{ transition: { onExited } }}>
      <DialogTitle>{product ? interpolate(labels.title, { name: product.namePt }) : null}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary">
          {labels.description}
        </Typography>

        {detailQuery.isLoading ? (
          <Box sx={GRID_SX} aria-busy>
            {Array.from({ length: Math.max(1, Math.min(product?.imageCount ?? 3, 6)) }).map((_, index) => (
              <Skeleton key={index} variant="rounded" sx={{ aspectRatio: "1", height: "auto" }} />
            ))}
          </Box>
        ) : null}

        {detailQuery.isError ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {errorLabel}
          </Alert>
        ) : null}

        {detailQuery.isSuccess && images.length === 0 ? (
          <Typography sx={{ mt: 2 }}>{labels.empty}</Typography>
        ) : null}

        {images.length > 0 ? (
          <Box sx={GRID_SX}>
            {images.map((image) => (
              <ProductImageTile
                key={image.id}
                image={image}
                isCover={image.id === coverId}
                locale={locale}
                labels={dictionary.form.images}
                actions={
                  <ActionIconButton
                    label={labels.download}
                    ariaLabel={interpolate(labels.downloadNamed, { filename: image.filename })}
                    icon={<DownloadIcon fontSize="small" />}
                    href={productImageDownloadHref(image.id)}
                  />
                }
              />
            ))}
          </Box>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{labels.close}</Button>
        {product && images.length > 0 ? (
          <Button
            variant="contained"
            component="a"
            href={productImagesZipHref(product.id)}
            startIcon={<FolderZipOutlinedIcon />}
          >
            {labels.downloadAll}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
