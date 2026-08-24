"use client";

import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ImageIcon from "@mui/icons-material/Image";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import OndemandVideoIcon from "@mui/icons-material/OndemandVideo";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
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
import type { PortalDictionary } from "@/modules/portal/lib/types";

export type MaterialRow = {
  id: string;
  titlePt: string;
  titleEn: string | null;
  category: string | null;
  contentType: string;
  filename: string;
  sizeBytes: number;
  published: boolean;
  publishedAt: Date | string | null;
  downloadUrl: string;
  descriptionPt: string | null;
  descriptionEn: string | null;
};

type MaterialTableProps = {
  dictionary: PortalDictionary["materials"];
  rows: MaterialRow[];
  isLoading: boolean;
  canWrite: boolean;
  canDelete: boolean;
  onEdit: (id: string) => void;
  onDelete: (row: MaterialRow) => void;
};

/** Formata bytes em KB/MB — função pura, sem i18n (unidade "KB"/"MB" é universal). */
function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes >= 10 ? Math.round(megabytes) : megabytes.toFixed(1)} MB`;
}

function contentTypeIcon(contentType: string) {
  if (contentType === "application/pdf") return PictureAsPdfIcon;
  if (contentType.startsWith("video/")) return OndemandVideoIcon;
  if (contentType.startsWith("image/")) return ImageIcon;
  return InsertDriveFileIcon;
}

const CATEGORY_LABEL_KEY: Record<string, keyof PortalDictionary["materials"]["categories"]> = {
  commercial_policy: "commercial_policy",
  logistics: "logistics",
  contacts: "contacts",
  training: "training",
  other: "other",
};

export function MaterialTable({
  dictionary,
  rows,
  isLoading,
  canWrite,
  canDelete,
  onEdit,
  onDelete,
}: MaterialTableProps) {
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{dictionary.table.title}</TableCell>
            <TableCell>{dictionary.table.category}</TableCell>
            <TableCell>{dictionary.table.type}</TableCell>
            <TableCell>{dictionary.table.publishedAt}</TableCell>
            <TableCell>{dictionary.table.status}</TableCell>
            <TableCell>{dictionary.table.size}</TableCell>
            {canWrite || canDelete ? (
              <TableCell align="right">{dictionary.table.actions}</TableCell>
            ) : null}
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={`skel-${i}`}>
                  <TableCell><Skeleton width="60%" /></TableCell>
                  <TableCell><Skeleton width={80} /></TableCell>
                  <TableCell><Skeleton width={60} /></TableCell>
                  <TableCell><Skeleton width={100} /></TableCell>
                  <TableCell><Skeleton width={80} /></TableCell>
                  <TableCell><Skeleton width={60} /></TableCell>
                  <TableCell align="right"><Skeleton width={80} /></TableCell>
                </TableRow>
              ))
            : rows.map((row) => {
                const Icon = contentTypeIcon(row.contentType);
                const categoryKey = row.category ? CATEGORY_LABEL_KEY[row.category] : undefined;
                return (
                  <TableRow key={row.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {row.titlePt}
                      </Typography>
                      {row.titleEn ? (
                        <Typography variant="caption" color="text.secondary">
                          {row.titleEn}
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {categoryKey ? dictionary.categories[categoryKey] : (row.category ?? "—")}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <Icon fontSize="small" />
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {row.publishedAt ? new Date(row.publishedAt).toLocaleDateString() : "—"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={row.published ? dictionary.status.published : dictionary.status.draft}
                        color={row.published ? "success" : "default"}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {formatSize(row.sizeBytes)}
                      </Typography>
                    </TableCell>
                    {canWrite || canDelete ? (
                      <TableCell align="right">
                        {canWrite ? (
                          <Tooltip title={dictionary.form.editTitle}>
                            <IconButton
                              size="small"
                              onClick={() => onEdit(row.id)}
                              aria-label={dictionary.form.editTitle}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : null}
                        {canDelete ? (
                          <Tooltip title={dictionary.deleteConfirm.title}>
                            <IconButton
                              size="small"
                              onClick={() => onDelete(row)}
                              aria-label={dictionary.deleteConfirm.title}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : null}
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
