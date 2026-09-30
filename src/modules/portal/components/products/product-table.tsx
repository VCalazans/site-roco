"use client";

import { useMemo, type ReactNode } from "react";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import HideImageIcon from "@mui/icons-material/HideImage";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import StarIcon from "@mui/icons-material/Star";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { Locale } from "@/i18n/config";
import type {
  PackagingType,
  ProductBadge,
  ProductListItem,
} from "@/modules/portal/lib/product-types";
import type { PortalDictionary } from "@/modules/portal/lib/types";
import { interpolate } from "@/shared/lib/interpolate";
import { ProductRowActions } from "./product-row-actions";

const BADGE_LABEL_KEY: Record<ProductBadge, keyof PortalDictionary["products"]["badges"]> = {
  nacional: "nacional",
  universal: "universal",
  top: "top",
  tres_em_um: "tresEmUm",
  seguro: "seguro",
};

const PACKAGING_LABEL_KEY: Record<
  PackagingType,
  keyof PortalDictionary["products"]["form"]["packagingTypes"]
> = {
  peca: "peca",
  blister: "blister",
  caixa: "caixa",
  saco_plastico: "sacoPlastico",
};

/** Colunas secundárias somem em telas estreitas; a tabela ainda rola na horizontal. */
const FROM_MD = { xs: "none", md: "table-cell" } as const;
const FROM_LG = { xs: "none", lg: "table-cell" } as const;

type ProductTableProps = {
  dictionary: PortalDictionary["products"];
  locale: Locale;
  items: ProductListItem[];
  isLoading: boolean;
  /** Produtos com uma ação em andamento (evita clique duplo e mostra o estado). */
  busyIds: ReadonlySet<string>;
  /** `products:update` — edita e alterna destaque/campeão. */
  canWrite: boolean;
  /** `products:publish` — distinto de `canWrite` no contrato tRPC. */
  canPublish: boolean;
  /** `products:delete`. */
  canDelete: boolean;
  /** `product_images:download` — a coluna de fotos abre a galeria de download. */
  canOpenImages: boolean;
  onEdit: (product: ProductListItem) => void;
  onOpenImages: (product: ProductListItem) => void;
  onTogglePublished: (product: ProductListItem) => void;
  onToggleFeatured: (product: ProductListItem) => void;
  onToggleBestSeller: (product: ProductListItem) => void;
  onCopyLink: (product: ProductListItem) => void;
  onShareWhatsapp: (product: ProductListItem) => void;
  onDelete: (product: ProductListItem) => void;
};

function ProductThumb({ src }: { src: string | null }) {
  return (
    <Box
      aria-hidden
      sx={{
        flexShrink: 0,
        width: 48,
        height: 48,
        borderRadius: 1.5,
        overflow: "hidden",
        display: "grid",
        placeItems: "center",
        bgcolor: "action.hover",
        border: "1px solid",
        borderColor: "divider",
        color: "text.disabled",
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- miniaturas vêm do domínio público do R2, fora do `next/image` de propósito (mesma escolha de `product-images-manager.tsx`): a lista mostra dezenas de capas por página e o otimizador do Next as reprocessaria uma a uma.
        <img
          src={src}
          alt=""
          width={48}
          height={48}
          loading="lazy"
          decoding="async"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <HideImageIcon fontSize="small" />
      )}
    </Box>
  );
}

/**
 * Fotos da linha: total de imagens e quantas vão ao site. Produto com fotos
 * mas nenhuma no site ganha o aviso — no site ele aparece sem imagem. Com
 * `onOpen` (permissão de download), o número abre a galeria das originais.
 */
function PhotosCell({
  product,
  dictionary,
  onOpen,
}: {
  product: ProductListItem;
  dictionary: PortalDictionary["products"]["table"];
  onOpen?: () => void;
}) {
  if (product.imageCount === 0) {
    return (
      <Chip
        label={dictionary.noPhoto}
        size="small"
        color={product.published ? "warning" : "default"}
        variant="outlined"
      />
    );
  }

  const count = (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
      <PhotoCameraOutlinedIcon fontSize="small" />
      <Typography variant="body2">{product.imageCount}</Typography>
    </Box>
  );

  return (
    <Stack spacing={0.5} sx={{ alignItems: "center" }}>
      {onOpen ? (
        <Tooltip title={interpolate(dictionary.openImages, { name: product.namePt })}>
          <ButtonBase
            onClick={onOpen}
            aria-label={interpolate(dictionary.openImages, { name: product.namePt })}
            sx={{
              px: 1,
              py: 0.25,
              borderRadius: 1,
              color: "primary.main",
              "&:hover": { bgcolor: "action.hover" },
              "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main" },
            }}
          >
            {count}
          </ButtonBase>
        </Tooltip>
      ) : (
        <Box sx={{ color: "text.secondary" }}>{count}</Box>
      )}
      {product.siteImageCount === 0 ? (
        <Chip
          label={dictionary.noSitePhoto}
          size="small"
          color={product.published ? "warning" : "default"}
          variant="outlined"
        />
      ) : product.siteImageCount < product.imageCount ? (
        <Typography variant="caption" color="text.secondary" noWrap>
          {interpolate(dictionary.onSite, { count: product.siteImageCount })}
        </Typography>
      ) : null}
    </Stack>
  );
}

type FlagToggleProps = {
  active: boolean;
  /** `products:update`. Sem ele o botão fica desabilitado (só mostra o estado). */
  editable: boolean;
  tone: "primary" | "secondary";
  onIcon: ReactNode;
  offIcon: ReactNode;
  /** Nome estável da flag ("Destaque na home"); o estado vai em `aria-pressed`. */
  flagLabel: string;
  productName: string;
  /** Texto do tooltip: a AÇÃO que o clique faz ("Destacar na home"). */
  actionLabel: string;
  onToggle: () => void;
};

function FlagToggle({
  active,
  editable,
  tone,
  onIcon,
  offIcon,
  flagLabel,
  productName,
  actionLabel,
  onToggle,
}: FlagToggleProps) {
  const button = (
    <IconButton
      size="small"
      disabled={!editable}
      aria-pressed={active}
      aria-label={`${flagLabel}: ${productName}`}
      onClick={onToggle}
      sx={{
        color: active ? `${tone}.main` : "text.disabled",
        // Desabilitado (sem permissão) ainda precisa mostrar QUAL é o estado.
        "&.Mui-disabled": { color: active ? `${tone}.main` : "action.disabled" },
      }}
    >
      {active ? onIcon : offIcon}
    </IconButton>
  );

  // Tooltip só em botão habilitado: em elemento desabilitado o MUI avisa e o
  // clone do filho diverge no SSR (ver "Micro-padrões" em systemPatterns.md).
  return editable ? <Tooltip title={actionLabel}>{button}</Tooltip> : button;
}

/**
 * Tabela do catálogo no portal (spec 001, RF10/RF31): miniatura, nome + SKU +
 * selos, categorias, alternância de destaque/campeão em um clique, publicação,
 * fotos, data e menu de ações (editar, ver no site, copiar link, compartilhar,
 * excluir).
 */
export function ProductTable({
  dictionary,
  locale,
  items,
  isLoading,
  busyIds,
  canWrite,
  canPublish,
  canDelete,
  canOpenImages,
  onEdit,
  onOpenImages,
  onTogglePublished,
  onToggleFeatured,
  onToggleBestSeller,
  onCopyLink,
  onShareWhatsapp,
  onDelete,
}: ProductTableProps) {
  const formatDate = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale, { dateStyle: "short" });
    return (iso: string) => formatter.format(new Date(iso));
  }, [locale]);

  return (
    <TableContainer>
      <Table size="small" sx={{ minWidth: 560 }}>
        <TableHead>
          <TableRow>
            <TableCell>{dictionary.table.product}</TableCell>
            <TableCell sx={{ display: FROM_MD }}>{dictionary.table.category}</TableCell>
            <TableCell align="center">{dictionary.table.showcase}</TableCell>
            <TableCell align="center">{dictionary.table.published}</TableCell>
            <TableCell align="center" sx={{ display: FROM_LG }}>
              {dictionary.table.photos}
            </TableCell>
            <TableCell sx={{ display: FROM_LG }}>{dictionary.table.updatedAt}</TableCell>
            <TableCell align="right">{dictionary.table.actions}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading
            ? Array.from({ length: 6 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={7}>
                    <Skeleton variant="rounded" height={48} />
                  </TableCell>
                </TableRow>
              ))
            : items.map((product) => {
                const busy = busyIds.has(product.id);
                // Todas as embalagens (já ordenadas pelo servidor) — não há "padrão".
                const packaging =
                  product.packagings.length > 0
                    ? product.packagings
                        .map(
                          (item) =>
                            `${dictionary.form.packagingTypes[PACKAGING_LABEL_KEY[item.packagingType]]} × ${item.unitsPerPack}`
                        )
                        .join(" · ")
                    : null;
                const [firstCategory, ...otherCategories] = product.categories;

                return (
                  <TableRow key={product.id} hover sx={{ opacity: busy ? 0.6 : 1 }}>
                    <TableCell sx={{ maxWidth: 380 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <ProductThumb src={product.coverUrl} />
                        <Box sx={{ minWidth: 0 }}>
                          {canWrite ? (
                            <Link
                              component="button"
                              type="button"
                              variant="body2"
                              underline="hover"
                              color="text.primary"
                              onClick={() => onEdit(product)}
                              sx={{ fontWeight: 600, textAlign: "left", maxWidth: "100%" }}
                            >
                              {product.namePt}
                            </Link>
                          ) : (
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {product.namePt}
                            </Typography>
                          )}
                          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                            {dictionary.table.sku} {product.sku}
                          </Typography>
                          {packaging ? (
                            // Linha própria: o SKU não se mistura com a lista de embalagens.
                            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                              {packaging}
                            </Typography>
                          ) : null}
                          {product.badges.length > 0 ? (
                            <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap", mt: 0.5 }}>
                              {product.badges.map((badge) => (
                                <Chip
                                  key={badge}
                                  label={dictionary.badges[BADGE_LABEL_KEY[badge]]}
                                  size="small"
                                  variant="outlined"
                                />
                              ))}
                            </Stack>
                          ) : null}
                        </Box>
                      </Box>
                    </TableCell>

                    <TableCell sx={{ display: FROM_MD }}>
                      {firstCategory ? (
                        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 160 }}>
                            {firstCategory.namePt}
                          </Typography>
                          {otherCategories.length > 0 ? (
                            <Tooltip title={otherCategories.map((category) => category.namePt).join(", ")}>
                              <Chip label={`+${otherCategories.length}`} size="small" variant="outlined" />
                            </Tooltip>
                          ) : null}
                        </Stack>
                      ) : (
                        <Typography variant="body2" color="text.disabled">
                          —
                        </Typography>
                      )}
                    </TableCell>

                    <TableCell align="center">
                      <Box sx={{ display: "inline-flex", gap: 0.5 }}>
                        <FlagToggle
                          active={product.featured}
                          editable={canWrite}
                          tone="primary"
                          onIcon={<StarIcon fontSize="small" />}
                          offIcon={<StarBorderIcon fontSize="small" />}
                          flagLabel={dictionary.form.fields.featured}
                          productName={product.namePt}
                          actionLabel={
                            product.featured
                              ? dictionary.flags.featuredRemove
                              : dictionary.flags.featuredAdd
                          }
                          onToggle={() => onToggleFeatured(product)}
                        />
                        <FlagToggle
                          active={product.bestSeller}
                          editable={canWrite}
                          tone="secondary"
                          onIcon={<EmojiEventsIcon fontSize="small" />}
                          offIcon={<EmojiEventsOutlinedIcon fontSize="small" />}
                          flagLabel={dictionary.form.fields.bestSeller}
                          productName={product.namePt}
                          actionLabel={
                            product.bestSeller
                              ? dictionary.flags.bestSellerRemove
                              : dictionary.flags.bestSellerAdd
                          }
                          onToggle={() => onToggleBestSeller(product)}
                        />
                      </Box>
                    </TableCell>

                    <TableCell align="center">
                      <Switch
                        size="small"
                        checked={product.published}
                        disabled={!canPublish || busy}
                        onChange={() => onTogglePublished(product)}
                        slotProps={{
                          input: {
                            "aria-label": `${dictionary.form.fields.published}: ${product.namePt}`,
                          },
                        }}
                      />
                      {!product.active ? (
                        <Chip label={dictionary.status.inactive} size="small" color="warning" />
                      ) : null}
                    </TableCell>

                    <TableCell align="center" sx={{ display: FROM_LG }}>
                      <PhotosCell
                        product={product}
                        dictionary={dictionary.table}
                        onOpen={canOpenImages ? () => onOpenImages(product) : undefined}
                      />
                    </TableCell>

                    <TableCell sx={{ display: FROM_LG }}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        component="time"
                        dateTime={product.updatedAt}
                        noWrap
                      >
                        {formatDate(product.updatedAt)}
                      </Typography>
                    </TableCell>

                    <TableCell align="right">
                      <ProductRowActions
                        dictionary={dictionary.actions}
                        locale={locale}
                        product={product}
                        canEdit={canWrite}
                        canDelete={canDelete}
                        canOpenImages={canOpenImages}
                        onEdit={onEdit}
                        onOpenImages={onOpenImages}
                        onCopyLink={onCopyLink}
                        onShareWhatsapp={onShareWhatsapp}
                        onDelete={onDelete}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
