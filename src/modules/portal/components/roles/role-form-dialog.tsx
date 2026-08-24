"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/core/trpc-client";
import type { PortalDictionary } from "@/modules/portal/lib/types";
import type { RoleRow } from "./roles-profiles-tab";

type FormState = {
  name: string;
  slug: string;
  description: string;
};

const EMPTY: FormState = { name: "", slug: "", description: "" };

type RoleFormDialogProps = {
  open: boolean;
  onClose: () => void;
  /** `null` = criação de um perfil novo. */
  roleId: string | null;
  /** Lista já carregada pela aba "Perfis" — evita uma query extra só para
   *  hidratar o form (não existe `roles.byId` no contrato tRPC). */
  roles: RoleRow[];
  dictionary: PortalDictionary["roles"];
  errorLabel: string;
};

/**
 * Mirror simplificado de `hero-form-dialog.tsx` (sem abas, sem query de
 * detalhe própria — hidrata direto da lista já carregada pelo pai, já que
 * o dono do state remonta este componente com `key` novo a cada abertura,
 * mesmo padrão de `product-form-dialog.tsx`). O `slug` só é editável
 * (digitável) na CRIAÇÃO — em edição fica desabilitado com
 * `form.fields.slugHelper` como texto de ajuda (imutável por design, ver
 * decisionLog 2026-08-24).
 */
export function RoleFormDialog({
  open,
  onClose,
  roleId,
  roles,
  dictionary,
  errorLabel,
}: RoleFormDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<FormState>(() => {
    const existing = roleId ? roles.find((role) => role.id === roleId) : null;
    return existing
      ? { name: existing.name, slug: existing.slug, description: existing.description ?? "" }
      : EMPTY;
  });

  const isEditing = Boolean(roleId);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: trpc.roles.listRoles.queryKey() });
  }

  const createMutation = useMutation(
    trpc.roles.createRole.mutationOptions({
      onSuccess: () => {
        invalidate();
        onClose();
      },
    })
  );
  const updateMutation = useMutation(
    trpc.roles.updateRoleMeta.mutationOptions({
      onSuccess: () => {
        invalidate();
        onClose();
      },
    })
  );

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const hasError = createMutation.isError || updateMutation.isError;
  const errorMessage = createMutation.error?.message ?? updateMutation.error?.message ?? errorLabel;

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSave() {
    if (isEditing && roleId) {
      await updateMutation.mutateAsync({
        id: roleId,
        name: form.name.trim(),
        description: form.description || undefined,
      });
    } else {
      await createMutation.mutateAsync({
        slug: form.slug.trim(),
        name: form.name.trim(),
        description: form.description || undefined,
      });
    }
  }

  const canSave =
    form.name.trim().length > 0 && (isEditing || form.slug.trim().length > 0) && !isSaving;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{isEditing ? dictionary.form.editTitle : dictionary.form.createTitle}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <TextField
            label={dictionary.form.fields.name}
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            required
            fullWidth
          />
          <TextField
            label={dictionary.form.fields.slug}
            value={form.slug}
            onChange={(e) => setField("slug", e.target.value)}
            disabled={isEditing}
            helperText={isEditing ? dictionary.form.fields.slugHelper : undefined}
            fullWidth
          />
          <TextField
            label={dictionary.form.fields.description}
            value={form.description}
            onChange={(e) => setField("description", e.target.value)}
            multiline
            minRows={2}
            fullWidth
          />
          {hasError ? <Alert severity="error">{errorMessage}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{dictionary.form.actions.cancel}</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!canSave}
          startIcon={isSaving ? <CircularProgress size={16} /> : null}
        >
          {dictionary.form.actions.save}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
