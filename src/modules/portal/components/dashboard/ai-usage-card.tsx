"use client";

import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { MCP_CLIENTS, MCP_TOOL_NAMES } from "@/modules/ai/lib/ai-usage";
import type { PortalDashboardDictionary } from "@/modules/portal/lib/types";
import { interpolate } from "@/shared/lib/interpolate";

type AiUsageStats = {
  windowDays: number;
  connections: Record<(typeof MCP_CLIENTS)[number], number>;
  totalConnections: number;
  tools: Record<(typeof MCP_TOOL_NAMES)[number], number>;
  totalToolCalls: number;
  connectClicks: { home: number; ia: number };
  quoteLinksOpened: number;
  aiLeads: number;
};

type AiUsageCardProps = {
  dictionary: PortalDashboardDictionary["aiUsage"];
  stats?: AiUsageStats;
  loading: boolean;
  error: boolean;
  errorLabel: string;
  formatNumber: (value: number) => string;
  /** Página pública `/ia`. */
  aiPageHref: string;
  /** Solicitações (os orçamentos enviados ficam lá). */
  leadsHref: string;
};

function Metric({ label, value, hint, href }: { label: string; value: string; hint?: string; href?: string }) {
  const body = (
    <>
      <Typography variant="h5" component="p" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
        {value}
      </Typography>
      <Typography variant="body2">{label}</Typography>
      {hint ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
          {hint}
        </Typography>
      ) : null}
    </>
  );
  return (
    <Box
      sx={{ p: 1.5, borderRadius: 1, border: 1, borderColor: "divider", color: "inherit", textDecoration: "none" }}
      {...(href ? { component: Link, href } : {})}
    >
      {body}
    </Box>
  );
}

/**
 * "Uso da IA": quanto o conector MCP da ROCO é usado e quanto vira orçamento.
 * Conta conversas e consultas, não pessoas — o texto do card diz isso, para
 * ninguém ler "conversas" como "clientes com o conector instalado".
 */
export function AiUsageCard({
  dictionary,
  stats,
  loading,
  error,
  errorLabel,
  formatNumber,
  aiPageHref,
  leadsHref,
}: AiUsageCardProps) {
  const hasUsage =
    stats &&
    stats.totalConnections + stats.totalToolCalls + stats.connectClicks.home + stats.connectClicks.ia +
      stats.quoteLinksOpened + stats.aiLeads >
      0;

  return (
    <Paper variant="outlined" component="section" aria-labelledby="dashboard-ai-usage" sx={{ p: 2.5 }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <AutoAwesomeIcon color="primary" fontSize="small" aria-hidden />
          <Box>
            <Typography id="dashboard-ai-usage" variant="subtitle1" component="h2" sx={{ fontWeight: 600 }}>
              {dictionary.title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {interpolate(dictionary.subtitle, { days: stats?.windowDays ?? 30 })}
            </Typography>
          </Box>
        </Box>
        <Button
          href={aiPageHref}
          target="_blank"
          rel="noopener noreferrer"
          size="small"
          endIcon={<OpenInNewIcon fontSize="small" />}
        >
          {dictionary.viewPage}
        </Button>
      </Box>

      {error ? (
        <Alert severity="warning" sx={{ mt: 2 }}>
          {errorLabel}
        </Alert>
      ) : null}

      {loading ? (
        <Box aria-hidden sx={{ mt: 2, display: "grid", gap: 1 }}>
          <Skeleton variant="rounded" height={72} />
          <Skeleton variant="rounded" height={72} />
        </Box>
      ) : null}

      {!loading && stats && !hasUsage ? (
        <Typography color="text.secondary" sx={{ mt: 2 }}>
          {dictionary.empty}
        </Typography>
      ) : null}

      {!loading && stats && hasUsage ? (
        <Box sx={{ mt: 2, display: "grid", gap: 2 }}>
          <Box
            sx={{ display: "grid", gap: 1.5, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 200px), 1fr))" }}
          >
            <Metric label={dictionary.connections} value={formatNumber(stats.totalConnections)} />
            <Metric label={dictionary.toolCalls} value={formatNumber(stats.totalToolCalls)} />
            <Metric
              label={dictionary.connectClicks}
              value={formatNumber(stats.connectClicks.home + stats.connectClicks.ia)}
              hint={interpolate(dictionary.connectClicksHint, {
                home: formatNumber(stats.connectClicks.home),
                ia: formatNumber(stats.connectClicks.ia),
              })}
            />
            <Metric label={dictionary.quoteLinks} value={formatNumber(stats.quoteLinksOpened)} />
            <Metric
              label={dictionary.aiLeads}
              value={formatNumber(stats.aiLeads)}
              hint={dictionary.aiLeadsHint}
              href={leadsHref}
            />
          </Box>

          <Typography variant="caption" color="text.secondary">
            {dictionary.connectionsHint}
          </Typography>

          {stats.totalConnections > 0 ? (
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                {dictionary.byClient}
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {MCP_CLIENTS.filter((client) => stats.connections[client] > 0).map((client) => (
                  <Chip
                    key={client}
                    size="small"
                    variant="outlined"
                    label={`${dictionary.clients[client]}: ${formatNumber(stats.connections[client])}`}
                  />
                ))}
              </Box>
            </Box>
          ) : null}

          {stats.totalToolCalls > 0 ? (
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                {dictionary.toolCalls}
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {[...MCP_TOOL_NAMES]
                  .filter((tool) => stats.tools[tool] > 0)
                  .sort((a, b) => stats.tools[b] - stats.tools[a])
                  .map((tool) => (
                    <Chip
                      key={tool}
                      size="small"
                      variant="outlined"
                      label={`${dictionary.tools[tool]}: ${formatNumber(stats.tools[tool])}`}
                    />
                  ))}
              </Box>
            </Box>
          ) : null}
        </Box>
      ) : null}
    </Paper>
  );
}
