"use client";

import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import IconButton from "@mui/material/IconButton";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { inferRouterOutputs } from "@trpc/server";
import type { Locale } from "@/i18n/config";
import type { PortalLeadsDictionary } from "@/modules/portal/lib/leads-dictionary";
import type { AppRouter } from "@/server/trpc/routers/_app";
import { interpolate } from "@/shared/lib/interpolate";
import { LeadChannelStatus } from "./lead-channel-status";
import { LeadSubjectChip } from "./lead-subject-chip";
import { formatDate, formatTime, originLabel, summarizeLeadItems } from "./leads-helpers";

export type LeadListItem = inferRouterOutputs<AppRouter>["leads"]["list"]["items"][number];

/**
 * Colunas que somem em telas menores (a tabela tem 8 colunas; abaixo disso ela
 * exigiria rolagem horizontal). Nada se perde: a empresa passa a aparecer sob o
 * nome, e o resto está no detalhe, aberto ao tocar na linha.
 */
const HIDE_BELOW = {
  company: { xs: "none", lg: "table-cell" },
  items: { xs: "none", md: "table-cell" },
  origin: { xs: "none", xl: "table-cell" },
  channels: { xs: "none", sm: "table-cell" },
} as const;

type LeadsTableProps = {
  locale: Locale;
  dictionary: PortalLeadsDictionary;
  items: readonly LeadListItem[];
  isLoading: boolean;
  onOpen: (id: string) => void;
};

const SKELETON_ROWS = 6;

export function LeadsTable({ locale, dictionary, items, isLoading, onOpen }: LeadsTableProps) {
  const { table } = dictionary;

  return (
    <TableContainer>
      <Table size="small" aria-label={dictionary.title}>
        <TableHead>
          <TableRow>
            <TableCell>{table.receivedAt}</TableCell>
            <TableCell>{table.name}</TableCell>
            <TableCell sx={{ display: HIDE_BELOW.company }}>{table.company}</TableCell>
            <TableCell>{table.subject}</TableCell>
            <TableCell sx={{ display: HIDE_BELOW.items }}>{table.items}</TableCell>
            <TableCell sx={{ display: HIDE_BELOW.origin }}>{table.origin}</TableCell>
            <TableCell sx={{ display: HIDE_BELOW.channels }}>{table.channels}</TableCell>
            <TableCell align="right">{table.actions}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading
            ? Array.from({ length: SKELETON_ROWS }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Skeleton width={72} />
                    <Skeleton width={40} />
                  </TableCell>
                  <TableCell>
                    <Skeleton width={140} />
                  </TableCell>
                  <TableCell sx={{ display: HIDE_BELOW.company }}>
                    <Skeleton width={110} />
                  </TableCell>
                  <TableCell>
                    <Skeleton variant="rounded" width={120} height={24} />
                  </TableCell>
                  <TableCell sx={{ display: HIDE_BELOW.items }}>
                    <Skeleton width={120} />
                  </TableCell>
                  <TableCell sx={{ display: HIDE_BELOW.origin }}>
                    <Skeleton width={140} />
                  </TableCell>
                  <TableCell sx={{ display: HIDE_BELOW.channels }}>
                    <Skeleton variant="rounded" width={120} height={24} />
                  </TableCell>
                  <TableCell />
                </TableRow>
              ))
            : items.map((lead) => {
                const summary = summarizeLeadItems(lead, dictionary.items);
                const origin = originLabel(lead.origin, dictionary.origins);
                return (
                  <TableRow key={lead.id} hover sx={{ cursor: "pointer" }} onClick={() => onOpen(lead.id)}>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      <Typography variant="body2">{formatDate(lead.createdAt, locale)}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatTime(lead.createdAt, locale)}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 240 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>
                        {lead.name}
                      </Typography>
                      {/* A coluna "Empresa" some abaixo de `lg`: a empresa desce para debaixo do nome. */}
                      {lead.companyName ? (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: { xs: "block", lg: "none" }, overflowWrap: "anywhere" }}
                        >
                          {lead.companyName}
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell sx={{ display: HIDE_BELOW.company, maxWidth: 220, overflowWrap: "anywhere" }}>
                      {lead.companyName || "—"}
                    </TableCell>
                    <TableCell>
                      <LeadSubjectChip subject={lead.subject} label={dictionary.subjects[lead.subject]} />
                    </TableCell>
                    <TableCell sx={{ display: HIDE_BELOW.items, maxWidth: 240 }}>
                      {summary ? (
                        <>
                          <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
                            {summary.primary}
                          </Typography>
                          {summary.secondary ? (
                            <Typography variant="caption" color="text.secondary">
                              {summary.secondary}
                            </Typography>
                          ) : null}
                        </>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell sx={{ display: HIDE_BELOW.origin, maxWidth: 200 }}>
                      <Typography variant="body2" color={origin ? "text.primary" : "text.secondary"}>
                        {origin ?? "—"}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ display: HIDE_BELOW.channels }}>
                      <Stack direction="row" spacing={0.5}>
                        <LeadChannelStatus
                          channel={dictionary.channels.rdStation}
                          shortLabel={dictionary.channels.rdStationShort}
                          status={lead.rdStationStatus}
                          dictionary={dictionary.channels}
                        />
                        <LeadChannelStatus
                          channel={dictionary.channels.email}
                          shortLabel={dictionary.channels.email}
                          status={lead.emailStatus}
                          dictionary={dictionary.channels}
                        />
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        aria-label={interpolate(table.viewDetails, { name: lead.name })}
                        onClick={(event) => {
                          // O clique na linha inteira também abre o detalhe; sem isto o evento subiria e abriria duas vezes.
                          event.stopPropagation();
                          onOpen(lead.id);
                        }}
                      >
                        <ChevronRightIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
