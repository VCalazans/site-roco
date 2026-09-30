"use client";

import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { Locale } from "@/i18n/config";
import type { ProductImage } from "@/modules/portal/lib/product-types";
import type { PortalDictionary } from "@/modules/portal/lib/types";
import { formatFileSize } from "@/shared/lib/file-size";

type ImageLabels = Pick<PortalDictionary["products"]["form"]["images"], "cover" | "onSite" | "portalOnly">;

type ProductImageTileProps = {
  image: ProductImage;
  /** Capa da listagem no site (1ª imagem visível). */
  isCover: boolean;
  locale: Locale;
  labels: ImageLabels;
  /** Controles abaixo da miniatura (ex.: "Exibir no site"). */
  children?: ReactNode;
  /** Botões de ação (usar como capa, baixar, remover). */
  actions?: ReactNode;
};

/**
 * Uma imagem de produto no portal — o MESMO bloco no cadastro (onde se
 * escolhe o que vai ao site) e na galeria de download dos representantes:
 * miniatura, selo de capa, se aparece no site ou só no portal, nome do
 * arquivo e tamanho do ORIGINAL.
 */
export function ProductImageTile({ image, isCover, locale, labels, children, actions }: ProductImageTileProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1,
        display: "flex",
        flexDirection: "column",
        gap: 1,
        borderColor: isCover ? "primary.main" : undefined,
      }}
    >
      <Box
        sx={{
          position: "relative",
          width: "100%",
          aspectRatio: "1",
          overflow: "hidden",
          borderRadius: 1,
          bgcolor: "action.hover",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- miniatura do domínio público do R2, fora do `next/image` de propósito (mesma escolha da tabela de produtos): o otimizador reprocessaria cada miniatura do portal. */}
        <img
          src={image.url}
          alt={image.altPt ?? ""}
          loading="lazy"
          decoding="async"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            // Imagem que não vai ao site fica esmaecida: dá para ver de relance o que o visitante vê.
            opacity: image.showOnSite ? 1 : 0.55,
          }}
        />
        {isCover ? (
          <Chip
            label={labels.cover}
            size="small"
            color="primary"
            sx={{ position: "absolute", top: 6, left: 6, fontWeight: 600 }}
          />
        ) : null}
      </Box>

      <Stack spacing={0.5} sx={{ minWidth: 0 }}>
        <Chip
          label={image.showOnSite ? labels.onSite : labels.portalOnly}
          size="small"
          variant="outlined"
          color={image.showOnSite ? "success" : "default"}
          sx={{ alignSelf: "flex-start" }}
        />
        <Typography variant="caption" noWrap title={image.filename} sx={{ display: "block" }}>
          {image.altPt || image.filename}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {formatFileSize(image.sizeBytes, locale)}
        </Typography>
      </Stack>

      {children}

      {actions ? (
        <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end", mt: "auto" }}>
          {actions}
        </Stack>
      ) : null}
    </Paper>
  );
}
