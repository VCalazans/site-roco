"use client";

import RefreshIcon from "@mui/icons-material/Refresh";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/core/trpc-client";
import type { PortalDictionary } from "@/modules/portal/lib/types";

type SyncBarProps = {
  dictionary: PortalDictionary["products"]["sync"];
  /** Esconde o botão de disparo se o usuário não tiver `products:sync` (ou
   *  equivalente) — mesmo padrão de gate de UI usado nas demais ações
   *  destrutivas/administrativas desta página. */
  canTrigger: boolean;
};

/**
 * Barra de sincronização ERP: dispara `sync.trigger()` e acompanha
 * `sync.status()`, com poll a cada 3s enquanto o status for `running`.
 */
export function SyncBar({ dictionary, canTrigger }: SyncBarProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const statusQuery = useQuery(
    trpc.sync.status.queryOptions(undefined, {
      refetchInterval: (query) =>
        query.state.data?.status === "running" ? 3000 : false,
    })
  );

  const triggerMutation = useMutation(
    trpc.sync.trigger.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.sync.status.queryKey() });
      },
    })
  );

  const status = statusQuery.data?.status ?? "idle";
  const isRunning = status === "running" || triggerMutation.isPending;

  const statusLabel =
    status === "running"
      ? dictionary.statusRunning
      : status === "error"
        ? dictionary.statusError
        : dictionary.statusIdle;

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{
          alignItems: { xs: "flex-start", sm: "center" },
          justifyContent: "space-between",
        }}
      >
        <Stack spacing={0.25}>
          <Typography variant="subtitle2">{dictionary.title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {statusLabel}
            {statusQuery.data?.lastRunAt
              ? ` · ${dictionary.lastRun}: ${new Date(statusQuery.data.lastRunAt).toLocaleString()}`
              : null}
          </Typography>
        </Stack>

        {canTrigger ? (
          <Button
            variant="outlined"
            onClick={() => triggerMutation.mutate()}
            disabled={isRunning}
            startIcon={
              isRunning ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />
            }
          >
            {dictionary.triggerButton}
          </Button>
        ) : null}
      </Stack>

      {status === "error" ? (
        <Alert severity="error" sx={{ mt: 2 }}>
          {dictionary.errorMessage}
        </Alert>
      ) : null}
      {triggerMutation.isSuccess ? (
        <Alert severity="success" sx={{ mt: 2 }}>
          {dictionary.successMessage}
        </Alert>
      ) : null}
    </Paper>
  );
}
