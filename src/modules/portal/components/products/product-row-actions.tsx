"use client";

import { useId, useState } from "react";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import type { Locale } from "@/i18n/config";
import { productPublicPath } from "@/modules/portal/lib/product-links";
import type { ProductListItem } from "@/modules/portal/lib/product-types";
import type { PortalDictionary } from "@/modules/portal/lib/types";

type ProductRowActionsProps = {
  dictionary: PortalDictionary["products"]["actions"];
  locale: Locale;
  product: ProductListItem;
  /** `products:update`. */
  canEdit: boolean;
  /** `products:delete`. */
  canDelete: boolean;
  onEdit: (product: ProductListItem) => void;
  onCopyLink: (product: ProductListItem) => void;
  onShareWhatsapp: (product: ProductListItem) => void;
  onDelete: (product: ProductListItem) => void;
};

/**
 * Menu de ações da linha. "Ver no site", "Copiar link" e "Compartilhar no
 * WhatsApp" só existem para produto PUBLICADO (RF31): um link para um produto
 * despublicado cairia num 404 no site. Quem só consulta o catálogo (representante,
 * sem `products:update`/`delete`) ainda recebe essas três ações — é o que torna
 * o catálogo útil no atendimento — e, quando não sobra nenhuma ação, o botão
 * some em vez de abrir um menu vazio.
 */
export function ProductRowActions({
  dictionary,
  locale,
  product,
  canEdit,
  canDelete,
  onEdit,
  onCopyLink,
  onShareWhatsapp,
  onDelete,
}: ProductRowActionsProps) {
  const menuId = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = Boolean(anchor);
  const canShare = product.published;

  if (!canEdit && !canDelete && !canShare) return null;

  const close = () => setAnchor(null);
  const triggerLabel = `${dictionary.more}: ${product.namePt}`;

  return (
    <>
      <Tooltip title={dictionary.more}>
        <IconButton
          size="small"
          aria-label={triggerLabel}
          aria-haspopup="menu"
          aria-controls={open ? menuId : undefined}
          aria-expanded={open}
          onClick={(event) => setAnchor(event.currentTarget)}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Menu
        id={menuId}
        anchorEl={anchor}
        open={open}
        onClose={close}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {canEdit ? (
          <MenuItem
            onClick={() => {
              close();
              onEdit(product);
            }}
          >
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            {dictionary.edit}
          </MenuItem>
        ) : null}

        {canShare ? (
          <MenuItem
            component="a"
            href={productPublicPath(locale, product.slug)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={close}
          >
            <ListItemIcon>
              <OpenInNewIcon fontSize="small" />
            </ListItemIcon>
            {dictionary.viewOnSite}
          </MenuItem>
        ) : null}
        {canShare ? (
          <MenuItem
            onClick={() => {
              close();
              onCopyLink(product);
            }}
          >
            <ListItemIcon>
              <ContentCopyIcon fontSize="small" />
            </ListItemIcon>
            {dictionary.copyLink}
          </MenuItem>
        ) : null}
        {canShare ? (
          <MenuItem
            onClick={() => {
              close();
              onShareWhatsapp(product);
            }}
          >
            <ListItemIcon>
              <WhatsAppIcon fontSize="small" />
            </ListItemIcon>
            {dictionary.shareWhatsapp}
          </MenuItem>
        ) : null}

        {canDelete && (canEdit || canShare) ? <Divider /> : null}
        {canDelete ? (
          <MenuItem
            onClick={() => {
              close();
              onDelete(product);
            }}
            sx={{ color: "error.main" }}
          >
            <ListItemIcon sx={{ color: "inherit" }}>
              <DeleteIcon fontSize="small" />
            </ListItemIcon>
            {dictionary.delete}
          </MenuItem>
        ) : null}
      </Menu>
    </>
  );
}
