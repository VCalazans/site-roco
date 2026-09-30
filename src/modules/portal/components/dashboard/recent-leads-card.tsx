"use client";

import { useMemo } from "react";
import Link from "next/link";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import type { Locale } from "@/i18n/config";
import type { PortalDashboardDictionary, PortalLeadSubject } from "@/modules/portal/lib/types";

export type RecentLead = {
  id: string;
  createdAt: string;
  subject: PortalLeadSubject;
  name: string;
  companyName?: string | null;
};

const SUBJECT_COLOR: Record<PortalLeadSubject, "primary" | "secondary" | "info" | "default"> = {
  quote: "primary",
  cart: "primary",
  call_back: "secondary",
  catalog: "info",
  general: "default",
};

type RecentLeadsCardProps = {
  dictionary: PortalDashboardDictionary["recentLeads"];
  locale: Locale;
  /** Página de Solicitações (`/{locale}/portal/solicitacoes`). */
  viewAllHref: string;
  leads?: RecentLead[];
  loading: boolean;
  error: boolean;
  /** `portal.errors.generic`. */
  errorLabel: string;
};

/**
 * Últimas solicitações recebidas (assunto + quem enviou + quando). Só entra no
 * painel para quem tem `leads:read` — a consulta nem dispara sem a permissão.
 */
export function RecentLeadsCard({
  dictionary,
  locale,
  viewAllHref,
  leads,
  loading,
  error,
  errorLabel,
}: RecentLeadsCardProps) {
  const formatDate = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    return (iso: string) => formatter.format(new Date(iso));
  }, [locale]);

  return (
    <Paper variant="outlined" component="section" aria-labelledby="dashboard-recent-leads" sx={{ p: 2.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography id="dashboard-recent-leads" variant="subtitle1" component="h2" sx={{ fontWeight: 600 }}>
          {dictionary.title}
        </Typography>
        <Button
          component={Link}
          href={viewAllHref}
          size="small"
          endIcon={<ArrowForwardIcon fontSize="small" />}
        >
          {dictionary.viewAll}
        </Button>
      </Box>

      {error ? <Alert severity="warning">{errorLabel}</Alert> : null}

      {loading ? (
        <Box aria-hidden>
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} variant="text" height={44} />
          ))}
        </Box>
      ) : null}

      {!loading && !error && leads?.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
          {dictionary.empty}
        </Typography>
      ) : null}

      {!loading && leads && leads.length > 0 ? (
        <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
          {leads.map((lead, index) => (
            <Box component="li" key={lead.id}>
              {index > 0 ? <Divider /> : null}
              <Box
                sx={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  columnGap: 2,
                  rowGap: 0.5,
                  py: 1.25,
                }}
              >
                <Box sx={{ minWidth: 0, flex: "1 1 180px" }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                    {lead.name}
                  </Typography>
                  {lead.companyName ? (
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                      {lead.companyName}
                    </Typography>
                  ) : null}
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexShrink: 0 }}>
                  <Chip
                    size="small"
                    variant="outlined"
                    color={SUBJECT_COLOR[lead.subject]}
                    label={dictionary.subjects[lead.subject]}
                  />
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    component="time"
                    dateTime={lead.createdAt}
                    sx={{ minWidth: 96, textAlign: "right" }}
                  >
                    {formatDate(lead.createdAt)}
                  </Typography>
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      ) : null}
    </Paper>
  );
}
