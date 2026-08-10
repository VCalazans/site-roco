import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type {
  PackagingType,
  ProductBadge,
  ProductListItem,
} from "@/modules/portal/lib/product-types";
import type { PortalDictionary } from "@/modules/portal/lib/types";

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

type ProductTableProps = {
  dictionary: PortalDictionary["products"];
  items: ProductListItem[];
  isLoading: boolean;
  /** `products:update` — edita SKU/nome/categorias/badges/embalagens. */
  canWrite: boolean;
  /** `products:publish` — distinto de `canWrite` no contrato tRPC. */
  canPublish: boolean;
  /** `products:delete`. */
  canDelete: boolean;
  onEdit: (id: string) => void;
  onTogglePublished: (product: ProductListItem) => void;
  onDelete: (product: ProductListItem) => void;
};

export function ProductTable({
  dictionary,
  items,
  isLoading,
  canWrite,
  canPublish,
  canDelete,
  onEdit,
  onTogglePublished,
  onDelete,
}: ProductTableProps) {
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{dictionary.table.sku}</TableCell>
            <TableCell>{dictionary.table.name}</TableCell>
            <TableCell>{dictionary.table.category}</TableCell>
            <TableCell>{dictionary.table.packaging}</TableCell>
            <TableCell>{dictionary.table.badges}</TableCell>
            <TableCell>{dictionary.table.status}</TableCell>
            {canWrite || canPublish || canDelete ? (
              <TableCell align="right">{dictionary.table.actions}</TableCell>
            ) : null}
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading
            ? Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={7}>
                    <Skeleton variant="text" />
                  </TableCell>
                </TableRow>
              ))
            : items.map((product) => (
                <TableRow key={product.id} hover>
                  <TableCell>{product.sku}</TableCell>
                  <TableCell>
                    <Typography variant="body2">{product.namePt}</Typography>
                    {product.imageCount === 0 ? (
                      <Typography variant="caption" color="text.secondary">
                        {dictionary.form.images.title}: 0
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {product.categories.map((category) => category.namePt).join(", ")}
                  </TableCell>
                  <TableCell>
                    {product.defaultPackaging
                      ? `${dictionary.form.packagingTypes[PACKAGING_LABEL_KEY[product.defaultPackaging.packagingType]]} × ${product.defaultPackaging.unitsPerPack}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
                      {product.badges.map((badge) => (
                        <Chip
                          key={badge}
                          label={dictionary.badges[BADGE_LABEL_KEY[badge]]}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      <Chip
                        label={
                          product.published ? dictionary.status.published : dictionary.status.unpublished
                        }
                        color={product.published ? "success" : "default"}
                        size="small"
                      />
                      {!product.active ? (
                        <Chip label={dictionary.status.inactive} size="small" color="warning" />
                      ) : null}
                    </Stack>
                  </TableCell>
                  {canWrite || canPublish || canDelete ? (
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end" }}>
                        {canWrite ? (
                          <Tooltip title={dictionary.form.editTitle}>
                            <IconButton size="small" onClick={() => onEdit(product.id)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : null}
                        {canPublish ? (
                          <Tooltip
                            title={
                              product.published
                                ? dictionary.form.actions.unpublish
                                : dictionary.form.actions.publish
                            }
                          >
                            <IconButton size="small" onClick={() => onTogglePublished(product)}>
                              {product.published ? (
                                <VisibilityOffIcon fontSize="small" />
                              ) : (
                                <VisibilityIcon fontSize="small" />
                              )}
                            </IconButton>
                          </Tooltip>
                        ) : null}
                        {canDelete ? (
                          <Tooltip title={dictionary.form.actions.delete}>
                            <IconButton size="small" onClick={() => onDelete(product)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : null}
                      </Stack>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
