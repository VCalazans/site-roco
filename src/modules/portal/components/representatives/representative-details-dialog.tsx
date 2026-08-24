"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import BlockIcon from "@mui/icons-material/Block";
import DeleteIcon from "@mui/icons-material/Delete";
import RestoreIcon from "@mui/icons-material/Restore";
import DescriptionIcon from "@mui/icons-material/Description";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/core/trpc-client";
import { can, type PortalPermissionUser } from "@/modules/portal/lib/permissions";
import { formatCNPJ } from "@/shared/components/contact-form/cnpj";
import type { RepresentativeListItem } from "@/modules/portal/lib/representative-types";
import type { PortalDictionary } from "@/modules/portal/lib/types";

type RepresentativeDetailsDialogProps = {
  open: boolean;
  onClose: () => void;
  representative: RepresentativeListItem | null;
  portal: PortalDictionary;
  user: PortalPermissionUser;
};

/**
 * Dialog de detalhes do representante (2026-08-23, CRUD completo).
 * Mostra:
 *  - cabeçalho com nome, e-mail, status + badge "Desabilitado" se aplicável
 *  - CNPJ/telefone formatados, região, timestamps separados
 *  - notas do representante + notas do revisor (lado a lado)
 *  - documentos baixáveis (ícone + link, mesmo padrão da tabela)
 *  - motivo do desligamento (se desabilitado)
 *  - botões Disable / Reativar / Excluir (gated pelas permissions
 *    `representatives:disable` e `representatives:delete`; o admin é o
 *    único que tem ambas hoje).
 *  - estado secundário: `confirmDisable` (campo de motivo + OK) e
 *    `confirmDelete` (confirmação simples). Reativação é one-click.
 */
export function RepresentativeDetailsDialog({
  open,
  onClose,
  representative,
  portal,
  user,
}: RepresentativeDetailsDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const dictionary = portal.representatives;
  const common = portal.common;
  const fields = dictionary.fields;
  const details = dictionary.details;

  // Estado da UX dos botões: confirmações + motivo (disable).
  const [confirmingDisable, setConfirmingDisable] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [disableReason, setDisableReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const canDisable = can(user, "representatives", "disable");
  const canDelete = can(user, "representatives", "delete");

  const disableMutation = useMutation(
    trpc.representatives.disable.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.representatives.list.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.representatives.stats.queryKey() });
        setConfirmingDisable(false);
        setDisableReason("");
        onClose();
      },
      onError: (error) => {
        setActionError(error.message);
      },
    })
  );

  const enableMutation = useMutation(
    trpc.representatives.enable.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.representatives.list.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.representatives.stats.queryKey() });
        onClose();
      },
      onError: (error) => {
        setActionError(error.message);
      },
    })
  );

  const deleteMutation = useMutation(
    trpc.representatives.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.representatives.list.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.representatives.stats.queryKey() });
        setConfirmingDelete(false);
        onClose();
      },
      onError: (error) => {
        setActionError(error.message);
      },
    })
  );

  // Sem `useEffect` resetando state (proibido por `react-hooks/set-state-in-effect`):
  // o `key` no `<Dialog>` (passado pelo page-client como
  // `representative?.id ?? "closed"`) garante que o componente remonta
  // toda vez que troca de representante ou fecha — state local reseta sozinho.

  if (!representative) return null;

  const isDisabled = Boolean(representative.disabledAt);
  const isMutating = disableMutation.isPending || enableMutation.isPending || deleteMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <span>{representative.user.name ?? representative.user.email}</span>
          {isDisabled ? (
            <Chip
              size="small"
              label={dictionary.badge.disabled}
              color="error"
              variant="outlined"
            />
          ) : null}
        </Stack>
        <IconButton
          aria-label={common.cancel}
          onClick={onClose}
          size="small"
          sx={{ position: "absolute", right: 8, top: 8 }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {actionError ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {actionError}
          </Alert>
        ) : null}

        <Stack spacing={2}>
          {/* Cabeçalho: contato + status atual */}
          <Stack spacing={0.5}>
            <Typography variant="caption" color="text.secondary">
              {dictionary.table.name}
            </Typography>
            <Typography variant="body1">{representative.user.name ?? "—"}</Typography>
            <Typography variant="body2" color="text.secondary">
              {representative.user.email ?? "—"}
            </Typography>
          </Stack>

          <Divider />

          {/* Campos do cadastro */}
          <Stack spacing={1.5}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <Stack sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {details.cnpj}
                </Typography>
                <Typography variant="body2">
                  {representative.companyName ? formatCNPJ(representative.companyName) : "—"}
                </Typography>
              </Stack>
              <Stack sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {details.phone}
                </Typography>
                <Typography variant="body2">{representative.region ?? "—"}</Typography>
              </Stack>
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <Stack sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {details.region}
                </Typography>
                <Typography variant="body2">{representative.region ?? "—"}</Typography>
              </Stack>
              <Stack sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {details.submittedAt}
                </Typography>
                <Typography variant="body2">
                  {representative.submittedAt
                    ? new Date(representative.submittedAt).toLocaleString()
                    : "—"}
                </Typography>
              </Stack>
            </Stack>
          </Stack>

          {/* Soft-disable info (só se desabilitado) */}
          {isDisabled ? (
            <>
              <Divider />
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <BlockIcon fontSize="small" color="error" />
                  <Typography variant="subtitle2" color="error">
                    {fields.disabledAt}:{" "}
                    {representative.disabledAt
                      ? new Date(representative.disabledAt).toLocaleString()
                      : ""}
                  </Typography>
                </Stack>
                {representative.disabledByName ? (
                  <Typography variant="body2" color="text.secondary">
                    {fields.disabledBy}: {representative.disabledByName}
                  </Typography>
                ) : null}
                {representative.disableReason ? (
                  <Typography variant="body2">{representative.disableReason}</Typography>
                ) : null}
              </Stack>
            </>
          ) : null}

          {/* Documentos */}
          {representative.documents.length > 0 ? (
            <>
              <Divider />
              <Stack spacing={1}>
                <Typography variant="caption" color="text.secondary">
                  {details.documents}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                  {representative.documents.map((document) => (
                    <Chip
                      key={document.id}
                      component={Link}
                      href={document.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      clickable
                      icon={<DescriptionIcon />}
                      label={document.filename}
                      variant="outlined"
                      size="small"
                    />
                  ))}
                </Stack>
              </Stack>
            </>
          ) : null}

          {/* Confirmação de disable (campo de motivo) */}
          {canDisable && confirmingDisable ? (
            <>
              <Divider />
              <Stack spacing={1.5}>
                <Typography variant="subtitle2">{dictionary.confirmDisable.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {dictionary.confirmDisable.message}
                </Typography>
                <TextField
                  label={dictionary.confirmDisable.reasonLabel}
                  value={disableReason}
                  onChange={(e) => setDisableReason(e.target.value)}
                  fullWidth
                  size="small"
                  multiline
                  minRows={2}
                />
                <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
                  <Button size="small" onClick={() => setConfirmingDisable(false)} disabled={isMutating}>
                    {common.cancel}
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    color="warning"
                    onClick={() => disableMutation.mutate({ id: representative.id, reason: disableReason || undefined })}
                    disabled={isMutating}
                  >
                    {dictionary.confirmDisable.confirm}
                  </Button>
                </Stack>
              </Stack>
            </>
          ) : null}

          {/* Confirmação de delete */}
          {canDelete && confirmingDelete ? (
            <>
              <Divider />
              <Stack spacing={1.5}>
                <Typography variant="subtitle2" color="error">
                  {dictionary.confirmDelete.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {dictionary.confirmDelete.message}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
                  <Button size="small" onClick={() => setConfirmingDelete(false)} disabled={isMutating}>
                    {common.cancel}
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    color="error"
                    onClick={() => deleteMutation.mutate({ id: representative.id })}
                    disabled={isMutating}
                  >
                    {dictionary.confirmDelete.confirm}
                  </Button>
                </Stack>
              </Stack>
            </>
          ) : null}
        </Stack>
      </DialogContent>

      {!confirmingDisable && !confirmingDelete ? (
        <DialogActions>
          <Button onClick={onClose}>{common.cancel}</Button>
          {canDisable && !isDisabled ? (
            <Button
              startIcon={<BlockIcon />}
              color="warning"
              onClick={() => setConfirmingDisable(true)}
              disabled={isMutating}
            >
              {dictionary.actions.disable}
            </Button>
          ) : null}
          {canDisable && isDisabled ? (
            <Button
              startIcon={<RestoreIcon />}
              color="success"
              onClick={() => enableMutation.mutate({ id: representative.id })}
              disabled={isMutating}
            >
              {dictionary.actions.enable}
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              startIcon={<DeleteIcon />}
              color="error"
              onClick={() => setConfirmingDelete(true)}
              disabled={isMutating}
            >
              {dictionary.actions.delete}
            </Button>
          ) : null}
        </DialogActions>
      ) : null}
    </Dialog>
  );
}
