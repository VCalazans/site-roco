"use client";

import { useEffect, useState } from "react";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import BlockIcon from "@mui/icons-material/Block";
import DescriptionIcon from "@mui/icons-material/Description";
import InfoIcon from "@mui/icons-material/Info";
import SearchIcon from "@mui/icons-material/Search";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Link from "@mui/material/Link";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Tab from "@mui/material/Tab";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import FormControlLabel from "@mui/material/FormControlLabel";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/core/trpc-client";
import { DEFAULT_PORTAL_PER_PAGE } from "@/modules/portal/lib/pagination";
import { can, type PortalPermissionUser } from "@/modules/portal/lib/permissions";
import { useTerritoryIndex } from "@/modules/portal/lib/territory-client";
import {
  REPRESENTATIVE_STATUS_TABS,
  type RepresentativeListItem,
} from "@/modules/portal/lib/representative-types";
import type { RepresentativeStatus } from "@/modules/portal/lib/onboarding-types";
import type { PortalDictionary } from "@/modules/portal/lib/types";
import { PortalPagination } from "../shared/portal-pagination";
import { RepresentativeDetailsDialog } from "./representative-details-dialog";
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

/** Debounce da busca (ms) — evita disparar 1 query por tecla digitada. */
const SEARCH_DEBOUNCE_MS = 350;

export function RepresentativesPageClient({ portal, user }: RepresentativesPageClientProps) {
  const dictionary = portal.representatives;
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<RepresentativeStatus>("submitted");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<number>(DEFAULT_PORTAL_PER_PAGE);

  // Filtros (2026-08-23, CRUD completo): busca textual (debounced), estado de
  // atuação (UF, pela área cadastrada — base do IBGE) e toggle para incluir
  // soft-disabled.
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [uf, setUf] = useState("");
  const { index: territoryIndex } = useTerritoryIndex();
  const [includeDisabled, setIncludeDisabled] = useState(false);

  useEffect(() => {
    // A página volta ao início junto com o termo (dentro do timeout, não no
    // corpo do efeito); o `if` evita zerar a página quando o termo não mudou.
    const t = setTimeout(() => {
      const next = searchInput.trim();
      if (next !== search) {
        setSearch(next);
        setPage(1);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput, search]);

  // Todo filtro novo volta à página 1 (inline nos handlers, não via useEffect —
  // `useEffect(setState)` viola `react-hooks/set-state-in-effect`): a página 3
  // de um filtro pode nem existir no outro.

  // Reset estado do dialog de review ao trocar de representante / fechar.
  // (Não usamos o padrão de `useEffect(setState)` que viola
  // `react-hooks/set-state-in-effect` — o dialog de detalhes tem o seu
  // próprio `useEffect` interno que reseta ao abrir.)
  const [reviewTarget, setReviewTarget] = useState<RepresentativeListItem | null>(null);
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<RepresentativeListItem | null>(null);

  const listQuery = useQuery(
    trpc.representatives.list.queryOptions({
      status,
      page,
      perPage,
      search: search || undefined,
      uf: uf || undefined,
      includeDisabled,
    })
  );

  // Stats: cards do dashboard — total + breakdown. Alimenta os Tabs.
  const statsQuery = useQuery(trpc.representatives.stats.queryOptions());

  const reviewMutation = useMutation(
    trpc.representatives.review.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.representatives.list.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.representatives.stats.queryKey() });
        setReviewTarget(null);
        setDecision(null);
      },
    })
  );

  // Permissões gateiam a UI: cada ação na tabela/details exige a perm
  // correspondente. As perms `disable` e `delete` são admin-only; o dialog
  // de detalhes checa `canDisable`/`canDelete` internamente (passa o `user`
  // adiante) — aqui só precisamos de `canReview` para a linha da tabela.
  const canReview = can(user, "representatives", "review");
  const canDisable = can(user, "representatives", "disable");

  const items: RepresentativeListItem[] = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const stats = statsQuery.data;
  // Os 27 estados vêm da base do IBGE (a mesma do campo de área de atuação).
  const states = territoryIndex?.states ?? [];

  function handleStatusChange(nextStatus: RepresentativeStatus) {
    setStatus(nextStatus);
    setPage(1);
  }

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setUf("");
    setIncludeDisabled(false);
    setPage(1);
  }

  const hasActiveFilters = Boolean(search || uf || includeDisabled);

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
        onChange={(_event, value: RepresentativeStatus) => handleStatusChange(value)}
        sx={{ mb: 2 }}
      >
        {REPRESENTATIVE_STATUS_TABS.map((tabStatus) => {
          const count = stats ? stats[tabStatus] : undefined;
          return (
            <Tab
              key={tabStatus}
              value={tabStatus}
              label={
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <span>{portal.onboarding.status[tabStatus]}</span>
                  {typeof count === "number" ? (
                    <Chip size="small" label={count} variant="outlined" />
                  ) : null}
                </Stack>
              }
            />
          );
        })}
      </Tabs>

      {/* Filtros: busca + região + toggle "mostrar desabilitados" */}
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{ mb: 2, alignItems: { md: "center" } }}
      >
        <TextField
          label={dictionary.search.placeholder}
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          size="small"
          fullWidth
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <Select
            displayEmpty
            value={uf}
            onChange={(event) => {
              setUf(event.target.value as string);
              setPage(1);
            }}
            renderValue={(value) =>
              value ? (states.find((state) => state.uf === value)?.name ?? value) : portal.territory.filterAll
            }
            inputProps={{ "aria-label": portal.territory.filterLabel }}
          >
            <MenuItem value="">{portal.territory.filterAll}</MenuItem>
            {states.map((state) => (
              <MenuItem key={state.uf} value={state.uf}>
                {state.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControlLabel
          control={
            <Switch
              checked={includeDisabled}
              onChange={(event) => {
                setIncludeDisabled(event.target.checked);
                setPage(1);
              }}
              size="small"
            />
          }
          label={dictionary.filters.showDisabled}
        />
        {hasActiveFilters ? (
          <Button size="small" onClick={clearFilters}>
            {portal.common.clear}
          </Button>
        ) : null}
      </Stack>

      {listQuery.isError ? <Alert severity="error">{portal.errors.generic}</Alert> : null}

      {/* Empty state: distingue "nenhum representante neste status" de
          "nenhum resultado para os filtros aplicados" — copy específica. */}
      {!listQuery.isLoading && items.length === 0 && hasActiveFilters ? (
        <Paper variant="outlined" sx={{ p: 6, textAlign: "center" }}>
          <Typography variant="h6">{dictionary.emptySearch.title}</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            {dictionary.emptySearch.description}
          </Typography>
          <Button onClick={clearFilters} size="small">
            {portal.common.clear}
          </Button>
        </Paper>
      ) : null}

      {/* Empty state: copy contextual por aba. Sem filtros, a frase certa
          depende do status ativo — "aguardando revisão" em `submitted`,
          genérica em outras tabs (não é correto dizer "novos cadastros
          aparecerão aqui" na aba `approved`, por exemplo). */}
      {!listQuery.isLoading && items.length === 0 && !hasActiveFilters ? (
        <Paper variant="outlined" sx={{ p: 6, textAlign: "center" }}>
          <Typography variant="h6">
            {status === "submitted" ? dictionary.empty.title : dictionary.emptyByStatus[status]}
          </Typography>
          <Typography color="text.secondary">
            {status === "submitted" ? dictionary.empty.description : dictionary.emptyByStatus.hint}
          </Typography>
        </Paper>
      ) : null}

      {items.length > 0 ? (
        <Paper variant="outlined">
          <TableContainer>
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
                  : items.map((representative) => {
                      const isDisabled = Boolean(representative.disabledAt);
                      return (
                        <TableRow key={representative.id} hover>
                          <TableCell>
                            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                              <span>{representative.user.name ?? representative.user.email}</span>
                              {isDisabled ? (
                                <Chip
                                  size="small"
                                  label={dictionary.badge.disabled}
                                  color="error"
                                  variant="outlined"
                                />
                              ) : null}
                              {representative.user.emailVerified ? null : (
                                <Chip
                                  size="small"
                                  label={dictionary.badge.emailNotVerified}
                                  color="warning"
                                  variant="outlined"
                                />
                              )}
                            </Stack>
                          </TableCell>
                          <TableCell>{representative.companyName ?? "—"}</TableCell>
                          <TableCell sx={{ maxWidth: 260 }}>
                            <Typography variant="body2" noWrap title={representative.region ?? undefined}>
                              {representative.region ?? "—"}
                            </Typography>
                          </TableCell>
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
                              <Tooltip title={dictionary.actions.viewDetails}>
                                <IconButton
                                  size="small"
                                  onClick={() => setDetailsTarget(representative)}
                                  aria-label={dictionary.actions.viewDetails}
                                >
                                  <InfoIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
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
                              {canDisable && !isDisabled && representative.status === "submitted" ? (
                                <Tooltip title={dictionary.actions.disable}>
                                  <IconButton
                                    size="small"
                                    color="warning"
                                    onClick={() => setDetailsTarget(representative)}
                                    aria-label={dictionary.actions.disable}
                                  >
                                    <BlockIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              ) : null}
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })}
              </TableBody>
            </Table>
          </TableContainer>
          <PortalPagination
            page={page}
            perPage={perPage}
            total={total}
            onPageChange={setPage}
            onPerPageChange={(next) => {
              setPerPage(next);
              setPage(1);
            }}
          />
        </Paper>
      ) : null}

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

      <RepresentativeDetailsDialog
        open={Boolean(detailsTarget)}
        onClose={() => setDetailsTarget(null)}
        representative={detailsTarget}
        portal={portal}
        user={user}
      />
    </Box>
  );
}
