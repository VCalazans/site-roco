"use client";

import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ImageIcon from "@mui/icons-material/Image";
import OndemandVideoIcon from "@mui/icons-material/OndemandVideo";
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

export type HeroRow = {
  id: string;
  slug: string;
  kind: "youtube" | "upload";
  youtubeId: string | null;
  videoUrl: string | null;
  posterUrl: string | null;
  headlinePt: string;
  headlineEn: string | null;
  sortOrder: number;
  published: boolean;
  startsAt: Date | string | null;
  endsAt: Date | string | null;
  autoAdvanceSeconds: number | null;
  muted: boolean;
  r2Key: string | null;
  r2PosterKey: string | null;
  eyebrowPt: string | null;
  eyebrowEn: string | null;
  descriptionPt: string | null;
  descriptionEn: string | null;
  primaryCtaLabelPt: string | null;
  primaryCtaLabelEn: string | null;
  primaryCtaHref: string | null;
  secondaryCtaLabelPt: string | null;
  secondaryCtaLabelEn: string | null;
  secondaryCtaHref: string | null;
  loopWindowStartSeconds: number | null;
  loopWindowEndSeconds: number | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
};

type HeroTableProps = {
  dictionary: PortalDictionary["hero"];
  rows: HeroRow[];
  isLoading: boolean;
  canWrite: boolean;
  canDelete: boolean;
  onEdit: (id: string) => void;
  onDelete: (row: HeroRow) => void;
  onReorder: (orderedIds: string[]) => void;
  isReordering: boolean;
};

function windowState(
  row: HeroRow,
  now: number,
  dict: PortalDictionary["hero"]["status"]
): { label: string; tone: "default" | "warning" | "error" } {
  if (!row.published) return { label: dict.unpublished, tone: "default" };
  const start = row.startsAt ? new Date(row.startsAt).getTime() : null;
  const end = row.endsAt ? new Date(row.endsAt).getTime() : null;
  if (start && start > now) return { label: dict.scheduled, tone: "warning" };
  if (end && end <= now) return { label: dict.expired, tone: "error" };
  return { label: dict.published, tone: "default" };
}

export function HeroTable({
  dictionary,
  rows,
  isLoading,
  canWrite,
  canDelete,
  onEdit,
  onDelete,
  onReorder,
  isReordering,
}: HeroTableProps) {
  // Snapshot de "agora" usado para classificar status (scheduled/expired).
  // Calculado uma vez por render — o componente re-renderiza em mutações,
  // então qualquer drift é ≤ 1 ciclo de render. Aceitável para um painel
  // de admin (não exibe timers ao segundo).
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  function move(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= rows.length) return;
    const ordered = rows.map((r) => r.id);
    const [moved] = ordered.splice(idx, 1);
    ordered.splice(target, 0, moved);
    onReorder(ordered);
  }

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 64 }}>#</TableCell>
            <TableCell>{dictionary.table.kind}</TableCell>
            <TableCell>{dictionary.table.headline}</TableCell>
            <TableCell>{dictionary.table.status}</TableCell>
            <TableCell>{dictionary.table.window}</TableCell>
            {(canWrite || canDelete) ? (
              <TableCell align="right">{dictionary.table.actions}</TableCell>
            ) : null}
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={`skel-${i}`}>
                  <TableCell><Skeleton width={24} /></TableCell>
                  <TableCell><Skeleton width={80} /></TableCell>
                  <TableCell><Skeleton width="80%" /></TableCell>
                  <TableCell><Skeleton width={80} /></TableCell>
                  <TableCell><Skeleton width={120} /></TableCell>
                  <TableCell align="right"><Skeleton width={80} /></TableCell>
                </TableRow>
              ))
            : rows.map((row, idx) => {
                const w = windowState(row, now, dictionary.status);
                return (
                  <TableRow key={row.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={0} sx={{ alignItems: "center" }}>
                        {canWrite ? (
                          <>
                            <Tooltip title={dictionary.actions.moveUp}>
                              <span>
                                <IconButton
                                  size="small"
                                  disabled={idx === 0 || isReordering}
                                  onClick={() => move(idx, -1)}
                                  aria-label={dictionary.actions.moveUp}
                                >
                                  <ArrowUpwardIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title={dictionary.actions.moveDown}>
                              <span>
                                <IconButton
                                  size="small"
                                  disabled={idx === rows.length - 1 || isReordering}
                                  onClick={() => move(idx, 1)}
                                  aria-label={dictionary.actions.moveDown}
                                >
                                  <ArrowDownwardIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            {idx + 1}
                          </Typography>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        {row.kind === "youtube" ? (
                          <OndemandVideoIcon fontSize="small" />
                        ) : (
                          <ImageIcon fontSize="small" />
                        )}
                        <Typography variant="body2">
                          {row.kind === "youtube"
                            ? dictionary.kind.youtube
                            : dictionary.kind.upload}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {row.headlinePt}
                      </Typography>
                      {row.headlineEn ? (
                        <Typography variant="caption" color="text.secondary">
                          {row.headlineEn}
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={w.label} color={w.tone === "error" ? "error" : w.tone === "warning" ? "warning" : "success"} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {row.startsAt
                          ? new Date(row.startsAt).toLocaleString()
                          : "—"}
                        {" → "}
                        {row.endsAt
                          ? new Date(row.endsAt).toLocaleString()
                          : "—"}
                      </Typography>
                    </TableCell>
                    {(canWrite || canDelete) ? (
                      <TableCell align="right">
                        {canWrite ? (
                          <Tooltip title="Editar">
                            <IconButton size="small" onClick={() => onEdit(row.id)} aria-label="editar">
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : null}
                        {canDelete ? (
                          <Tooltip title={dictionary.deleteConfirm.title}>
                            <IconButton size="small" onClick={() => onDelete(row)} aria-label="deletar">
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
