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
import EditIcon from "@mui/icons-material/Edit";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/core/trpc-client";
import { can, type PortalPermissionUser } from "@/modules/portal/lib/permissions";
import { formatCNPJ } from "@/shared/components/contact-form/cnpj";
import { formatPhoneBR } from "@/shared/lib/phone";
import {
  representativeAdminUpdateSchema,
  type RepresentativeAdminUpdateInput,
} from "@/server/lib/representative-admin-update";
import type {
  RepresentativeEditErrorCode,
  RepresentativeListItem,
} from "@/modules/portal/lib/representative-types";
import type { PortalDictionary } from "@/modules/portal/lib/types";

type EditForm = {
  name: string;
  email: string;
  companyName: string;
  cnpj: string;
  phone: string;
  region: string;
  notes: string;
};

type EditField = keyof EditForm;

const EDIT_ERROR_CODES = new Set<string>([
  "required",
  "invalid_email",
  "invalid_cnpj",
  "invalid_phone",
  "email_exists",
  "cnpj_exists",
]);

/** Mensagem do servidor/zod → código conhecido (qualquer outra coisa vira `generic`). */
function toEditErrorCode(message: string | undefined): RepresentativeEditErrorCode {
  return message && EDIT_ERROR_CODES.has(message)
    ? (message as RepresentativeEditErrorCode)
    : "generic";
}

function formFromRepresentative(representative: RepresentativeListItem): EditForm {
  return {
    name: representative.user.name ?? "",
    email: representative.user.email ?? "",
    companyName: representative.companyName ?? "",
    cnpj: representative.cnpj ?? "",
    phone: representative.phone ?? "",
    region: representative.region ?? "",
    notes: representative.notes ?? "",
  };
}

/** Rótulo + valor do modo de visualização. */
function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <Stack sx={{ flex: 1, minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ overflowWrap: "anywhere", whiteSpace: "pre-line" }}>
        {value || "—"}
      </Typography>
    </Stack>
  );
}

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
 *  - edição completa (`representatives:update`, 2026-09-16): nome, e-mail de
 *    login, razão social, CNPJ, telefone, região e observações — validada no
 *    cliente com o MESMO schema do servidor (`representative-admin-update.ts`).
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
  const [form, setForm] = useState<EditForm | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<EditField, string>>>({});
  const editing = form !== null;

  const canDisable = can(user, "representatives", "disable");
  const canDelete = can(user, "representatives", "delete");
  const canEdit = can(user, "representatives", "update");

  const updateMutation = useMutation(
    trpc.representatives.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.representatives.list.queryKey() });
        onClose();
      },
      onError: (error) => {
        const code = toEditErrorCode(error.message);
        if (code === "email_exists") {
          setFieldErrors({ email: dictionary.edit.errors.email_exists });
        } else if (code === "cnpj_exists") {
          setFieldErrors({ cnpj: dictionary.edit.errors.cnpj_exists });
        } else {
          setActionError(dictionary.edit.errors[code]);
        }
      },
    })
  );

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
  const isMutating =
    disableMutation.isPending ||
    enableMutation.isPending ||
    deleteMutation.isPending ||
    updateMutation.isPending;

  const startEditing = () => {
    setForm(formFromRepresentative(representative));
    setFieldErrors({});
    setActionError(null);
  };

  const cancelEditing = () => {
    setForm(null);
    setFieldErrors({});
    setActionError(null);
  };

  const setField = (field: EditField, value: string) => {
    setForm((current) => (current ? { ...current, [field]: value } : current));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submitEdit = () => {
    if (!form) return;
    setActionError(null);
    const payload: RepresentativeAdminUpdateInput = { id: representative.id, ...form };
    const parsed = representativeAdminUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      const errors: Partial<Record<EditField, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && field in form && !errors[field as EditField]) {
          const code = toEditErrorCode(issue.message);
          errors[field as EditField] = dictionary.edit.errors[code === "generic" ? "required" : code];
        }
      }
      setFieldErrors(errors);
      return;
    }
    updateMutation.mutate(payload);
  };

  const renderEditField = (
    field: EditField,
    label: string,
    options: {
      format?: (value: string) => string;
      helperText?: string;
      multiline?: boolean;
      type?: string;
    } = {}
  ) => (
    <TextField
      label={label}
      value={form?.[field] ?? ""}
      onChange={(event) =>
        setField(field, options.format ? options.format(event.target.value) : event.target.value)
      }
      error={Boolean(fieldErrors[field])}
      helperText={fieldErrors[field] ?? options.helperText}
      type={options.type}
      multiline={options.multiline}
      minRows={options.multiline ? 3 : undefined}
      disabled={isMutating}
      size="small"
      fullWidth
    />
  );

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
          {editing ? (
            <Stack spacing={2}>
              <Typography variant="subtitle2">{dictionary.edit.title}</Typography>
              {renderEditField("name", details.name)}
              {renderEditField("email", details.email, {
                type: "email",
                helperText: dictionary.edit.emailHint,
              })}
              {renderEditField("companyName", details.companyName)}
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                {renderEditField("cnpj", details.cnpj, { format: formatCNPJ })}
                {renderEditField("phone", details.phone, { format: formatPhoneBR, type: "tel" })}
              </Stack>
              {renderEditField("region", details.region)}
              {renderEditField("notes", details.notes, { multiline: true })}
            </Stack>
          ) : (
            <>
              {/* Cabeçalho: contato */}
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <DetailField label={details.name} value={representative.user.name} />
                <DetailField label={details.email} value={representative.user.email} />
              </Stack>

              <Divider />

              {/* Campos do cadastro */}
              <Stack spacing={1.5}>
                <DetailField label={details.companyName} value={representative.companyName} />
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <DetailField label={details.cnpj} value={representative.cnpj} />
                  <DetailField label={details.phone} value={representative.phone} />
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <DetailField label={details.region} value={representative.region} />
                  <DetailField
                    label={details.submittedAt}
                    value={
                      representative.submittedAt
                        ? new Date(representative.submittedAt).toLocaleString()
                        : null
                    }
                  />
                </Stack>
                {representative.notes ? (
                  <DetailField label={details.notes} value={representative.notes} />
                ) : null}
                {representative.reviewNotes ? (
                  <DetailField label={details.reviewNotes} value={representative.reviewNotes} />
                ) : null}
              </Stack>
            </>
          )}

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

      {editing ? (
        <DialogActions>
          <Button onClick={cancelEditing} disabled={isMutating}>
            {common.cancel}
          </Button>
          <Button variant="contained" onClick={submitEdit} disabled={isMutating}>
            {updateMutation.isPending ? dictionary.edit.saving : dictionary.edit.save}
          </Button>
        </DialogActions>
      ) : null}

      {!editing && !confirmingDisable && !confirmingDelete ? (
        <DialogActions>
          <Button onClick={onClose}>{common.cancel}</Button>
          {canEdit ? (
            <Button startIcon={<EditIcon />} onClick={startEditing} disabled={isMutating}>
              {dictionary.actions.edit}
            </Button>
          ) : null}
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
