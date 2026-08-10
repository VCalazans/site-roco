"use client";

import type { ReactNode } from "react";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import PeopleIcon from "@mui/icons-material/People";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/core/trpc-client";
import { can, type PortalPermissionUser } from "@/modules/portal/lib/permissions";
import type { PortalDictionary } from "@/modules/portal/lib/types";

type DashboardSummaryProps = {
  portal: PortalDictionary;
  user: PortalPermissionUser;
};

function SummaryCard({
  icon,
  label,
  value,
  loading,
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
  loading: boolean;
}) {
  return (
    <Card variant="outlined" sx={{ minWidth: 220, flex: 1 }}>
      <CardContent>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          <Box sx={{ color: "primary.main" }}>{icon}</Box>
          <Box>
            <Typography variant="body2" color="text.secondary">
              {label}
            </Typography>
            {loading ? (
              <CircularProgress size={20} />
            ) : (
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {value}
              </Typography>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

/**
 * Cards de resumo do dashboard: contagem de produtos publicados e
 * representantes pendentes de revisão via tRPC, condicionados à mesma
 * permissão que dá acesso às respectivas páginas (`products:read` /
 * `representatives:read`). Se o usuário não tem NENHuma das duas
 * permissões nem a role `representative` (não é o público destas listagens),
 * cai no `emptyState` estático do dicionário.
 */
export function DashboardSummary({ portal, user }: DashboardSummaryProps) {
  const trpc = useTRPC();

  const canReadProducts = can(user, "products", "read");
  const canReadRepresentatives = can(user, "representatives", "read");

  // `products.list` não expõe contagem total (só `items`/`nextCursor` — ver
  // contrato); `limit: 50` + sufixo "+" quando `nextCursor` existir é a
  // aproximação mais simples sem introduzir um endpoint de contagem novo.
  const productsQuery = useQuery(
    trpc.products.list.queryOptions(
      { limit: 50 },
      { enabled: canReadProducts }
    )
  );

  const representativesQuery = useQuery(
    trpc.representatives.list.queryOptions(
      { status: "submitted" },
      { enabled: canReadRepresentatives }
    )
  );

  if (!canReadProducts && !canReadRepresentatives) {
    return (
      <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
        <Typography color="text.secondary">{portal.dashboard.emptyState}</Typography>
      </Paper>
    );
  }

  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
      {canReadProducts ? (
        <SummaryCard
          icon={<Inventory2Icon />}
          label={portal.shell.nav.products}
          value={
            productsQuery.data
              ? `${productsQuery.data.items.length}${productsQuery.data.nextCursor ? "+" : ""}`
              : 0
          }
          loading={productsQuery.isLoading}
        />
      ) : null}
      {canReadRepresentatives ? (
        <SummaryCard
          icon={<PeopleIcon />}
          label={portal.onboarding.status.submitted}
          value={representativesQuery.data?.length ?? 0}
          loading={representativesQuery.isLoading}
        />
      ) : null}
    </Stack>
  );
}
