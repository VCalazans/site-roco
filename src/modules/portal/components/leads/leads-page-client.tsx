"use client";

import { useEffect, useState } from "react";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/core/trpc-client";
import type { Locale } from "@/i18n/config";
import type { PortalLeadsDictionary } from "@/modules/portal/lib/leads-dictionary";
import type { ContactSubject } from "@/server/lib/contact-submit";
import { DEFAULT_PORTAL_PER_PAGE } from "@/modules/portal/lib/pagination";
import { PortalPagination } from "../shared/portal-pagination";
import { LeadDetailDialog } from "./lead-detail-dialog";
import { LeadsTable } from "./leads-table";
import { SUBJECT_FILTER_ORDER, type LeadReplyTemplates } from "./leads-helpers";

const SEARCH_DEBOUNCE_MS = 350;

type SubjectFilter = ContactSubject | "all";

type LeadsPageClientProps = {
  /** Idioma da interface do painel. */
  locale: Locale;
  dictionary: PortalLeadsDictionary;
  /** Textos de resposta nos dois idiomas do site (a resposta segue o idioma do visitante). */
  replyTemplates: LeadReplyTemplates;
};

/**
 * Caixa de Solicitações (`/portal/solicitacoes`, spec 001, RF29): os leads que o
 * site grava em `contact_submissions`, com busca, filtro por assunto, paginação
 * e detalhe. Somente leitura — a página é gateada por `leads:read` no servidor.
 */
export function LeadsPageClient({ locale, dictionary, replyTemplates }: LeadsPageClientProps) {
  const trpc = useTRPC();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState<SubjectFilter>("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<number>(DEFAULT_PORTAL_PER_PAGE);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // A busca só dispara depois de uma pausa na digitação; a página volta ao início
  // junto com o termo (dentro do timeout, não no corpo do efeito). O `if` evita
  // zerar a página quando o termo aplicado não mudou (ex.: no primeiro render).
  useEffect(() => {
    const timeout = setTimeout(() => {
      const next = searchInput.trim();
      if (next !== search) {
        setSearch(next);
        setPage(1);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchInput, search]);

  const listQuery = useQuery(
    trpc.leads.list.queryOptions(
      {
        search: search || undefined,
        subject: subject === "all" ? undefined : subject,
        page,
        perPage,
      },
      // Trocar de página/filtro mantém a tabela anterior na tela (esmaecida) em vez de piscar o esqueleto.
      { placeholderData: keepPreviousData }
    )
  );

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const hasFilters = search !== "" || subject !== "all";

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setSubject("all");
    setPage(1);
  }

  function openDetail(id: string) {
    setDetailId(id);
    setDetailOpen(true);
  }

  return (
    <Box>
      <Stack
        direction="row"
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: "flex-start", mb: 3 }}
      >
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            {dictionary.title}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {dictionary.subtitle}
          </Typography>
        </Box>
        <IconButton
          aria-label={dictionary.refresh}
          onClick={() => void listQuery.refetch()}
          disabled={listQuery.isFetching}
          sx={{ flexShrink: 0 }}
        >
          {listQuery.isFetching ? <CircularProgress size={20} /> : <RefreshIcon />}
        </IconButton>
      </Stack>

      <Tabs
        value={subject}
        onChange={(_event, value: SubjectFilter) => {
          setSubject(value);
          setPage(1);
        }}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        aria-label={dictionary.filters.subjectAria}
        sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
      >
        <Tab value="all" label={dictionary.filters.all} />
        {SUBJECT_FILTER_ORDER.map((option) => (
          <Tab key={option} value={option} label={dictionary.subjects[option]} />
        ))}
      </Tabs>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        {/* Filtro de listagem sobre tabela: `size="small"` deliberado (regra de densidade em `src/core/theme/index.ts`). */}
        <TextField
          size="small"
          label={dictionary.search.label}
          placeholder={dictionary.search.placeholder}
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { maxLength: 120 },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
      </Paper>

      {listQuery.isError && !listQuery.data ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => void listQuery.refetch()}>
              {dictionary.error.retry}
            </Button>
          }
        >
          <Typography variant="subtitle2" component="span" sx={{ display: "block" }}>
            {dictionary.error.title}
          </Typography>
          {dictionary.error.description}
        </Alert>
      ) : !listQuery.isLoading && items.length === 0 ? (
        <Paper variant="outlined" sx={{ p: { xs: 4, sm: 6 }, textAlign: "center" }}>
          <InboxOutlinedIcon color="disabled" sx={{ fontSize: 40 }} />
          <Typography variant="h6" component="h2" sx={{ mt: 1 }}>
            {hasFilters ? dictionary.empty.filteredTitle : dictionary.empty.title}
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 480, mx: "auto" }}>
            {hasFilters ? dictionary.empty.filteredDescription : dictionary.empty.description}
          </Typography>
          {hasFilters ? (
            <Button sx={{ mt: 2 }} onClick={clearFilters}>
              {dictionary.empty.clearFilters}
            </Button>
          ) : null}
        </Paper>
      ) : (
        <Paper variant="outlined">
          <Box sx={{ opacity: listQuery.isPlaceholderData ? 0.6 : 1, transition: "opacity 120ms" }}>
            <LeadsTable
              locale={locale}
              dictionary={dictionary}
              items={items}
              isLoading={listQuery.isLoading}
              onOpen={openDetail}
            />
          </Box>
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
      )}

      <LeadDetailDialog
        leadId={detailId}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onExited={() => setDetailId(null)}
        locale={locale}
        dictionary={dictionary}
        replyTemplates={replyTemplates}
      />
    </Box>
  );
}
