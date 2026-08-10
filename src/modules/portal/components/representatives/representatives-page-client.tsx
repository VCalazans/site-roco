"use client";

import { useState } from "react";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import DescriptionIcon from "@mui/icons-material/Description";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tabs from "@mui/material/Tabs";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/core/trpc-client";
import { can, type PortalPermissionUser } from "@/modules/portal/lib/permissions";
import {
  REPRESENTATIVE_STATUS_TABS,
  type RepresentativeListItem,
} from "@/modules/portal/lib/representative-types";
import type { RepresentativeStatus } from "@/modules/portal/lib/onboarding-types";
import type { PortalDictionary } from "@/modules/portal/lib/types";
import { ReviewDialog } from "./review-dialog";

type RepresentativesPageClientProps = {
  portal: PortalDictionary;
  user: PortalPermissionUser;
};

const STATUS_COLOR: Record<RepresentativeStatus, "default" | "warning" | "success" | "error"> = {
  draft: "default",
  submitted: "warning",
  approved: "success",
  rejected: "error",
};

/**
 * Tabela de revisão de representantes, com abas por status (`submitted`
 * default). Ações de aprovar/rejeitar só aparecem para itens `submitted` e
 * exigem `representatives:review`; a página em si (rota) já exige
 * `representatives:read` para renderizar (ver `page.tsx`).
 */
export function RepresentativesPageClient({ portal, user }: RepresentativesPageClientProps) {
  const dictionary = portal.representatives;
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<RepresentativeStatus>("submitted");
  const [reviewTarget, setReviewTarget] = useState<RepresentativeListItem | null>(null);
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(null);

  const listQuery = useQuery(trpc.representatives.list.queryOptions({ status }));

  const reviewMutation = useMutation(
    trpc.representatives.review.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.representatives.list.queryKey() });
        setReviewTarget(null);
        setDecision(null);
      },
    })
  );

  // Espelha `permissionProcedure("representatives", "review")` em
  // `src/server/trpc/routers/representatives.ts` — único par resource:action
  // que a mutation `review` exige (não há um "representatives:update" genérico).
  const canReview = can(user, "representatives", "review");
  const items: RepresentativeListItem[] = listQuery.data ?? [];

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        {dictionary.title}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        {dictionary.subtitle}
      </Typography>

      <Tabs
        value={status}
        onChange={(_event, value: RepresentativeStatus) => setStatus(value)}
        sx={{ mb: 2 }}
      >
        {REPRESENTATIVE_STATUS_TABS.map((tabStatus) => (
          <Tab
            key={tabStatus}
            value={tabStatus}
            label={portal.onboarding.status[tabStatus]}
          />
        ))}
      </Tabs>

      {listQuery.isError ? <Alert severity="error">{portal.errors.generic}</Alert> : null}

      {!listQuery.isLoading && items.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 6, textAlign: "center" }}>
          <Typography variant="h6">{dictionary.empty.title}</Typography>
          <Typography color="text.secondary">{dictionary.empty.description}</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{dictionary.table.name}</TableCell>
                <TableCell>{dictionary.table.company}</TableCell>
                <TableCell>{dictionary.table.region}</TableCell>
                <TableCell>{dictionary.table.status}</TableCell>
                <TableCell>{dictionary.table.submittedAt}</TableCell>
                <TableCell align="right">{dictionary.table.actions}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {listQuery.isLoading
                ? Array.from({ length: 4 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={6}>
                        <Skeleton variant="text" />
                      </TableCell>
                    </TableRow>
                  ))
                : items.map((representative) => (
                    <TableRow key={representative.id} hover>
                      <TableCell>{representative.user.name ?? representative.user.email}</TableCell>
                      <TableCell>{representative.companyName ?? "—"}</TableCell>
                      <TableCell>{representative.region ?? "—"}</TableCell>
                      <TableCell>
                        <Chip
                          label={portal.onboarding.status[representative.status]}
                          color={STATUS_COLOR[representative.status]}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {representative.submittedAt
                          ? new Date(representative.submittedAt).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end" }}>
                          {representative.documents.map((document) => (
                            <Tooltip key={document.id} title={dictionary.review.viewDocuments}>
                              <IconButton
                                size="small"
                                component={Link}
                                href={document.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <DescriptionIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          ))}
                          {canReview && representative.status === "submitted" ? (
                            <>
                              <Tooltip title={dictionary.review.approve}>
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={() => {
                                    setReviewTarget(representative);
                                    setDecision("approved");
                                  }}
                                >
                                  <CheckIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={dictionary.review.reject}>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => {
                                    setReviewTarget(representative);
                                    setDecision("rejected");
                                  }}
                                >
                                  <CloseIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          ) : null}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <ReviewDialog
        representative={reviewTarget}
        decision={decision}
        onClose={() => {
          setReviewTarget(null);
          setDecision(null);
        }}
        onConfirm={(notes) => {
          if (reviewTarget && decision) {
            reviewMutation.mutate({ id: reviewTarget.id, decision, notes: notes || undefined });
          }
        }}
        isSubmitting={reviewMutation.isPending}
        dictionary={dictionary}
        commonDictionary={portal.common}
      />
    </Box>
  );
}
