"use client";

import { useState, type FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/core/trpc-client";
import type { PortalDictionary } from "@/modules/portal/lib/types";
import { interpolate } from "@/shared/lib/interpolate";

type InviteUserDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Depois de criar: recarrega a lista e mostra o desfecho do e-mail. */
  onInvited: (message: { severity: "success" | "warning"; text: string }) => void;
  roles: { id: string; name: string }[];
  locale: "pt" | "en";
  copy: PortalDictionary["roles"]["users"]["invite"];
};

/**
 * Convidar usuário (Perfis › Usuários): nome, e-mail e perfil. O servidor cria
 * a conta sem senha e manda o link para a pessoa definir a própria senha.
 * Regras (anti-escalonamento, e-mail repetido) só no servidor — o erro dele é
 * mostrado como veio.
 */
export function InviteUserDialog({ open, onClose, onInvited, roles, locale, copy }: InviteUserDialogProps) {
  const trpc = useTRPC();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");

  const invite = useMutation(
    trpc.roles.inviteUser.mutationOptions({
      onSuccess: (result, variables) => {
        const text =
          result.mail === "sent"
            ? interpolate(copy.sent, { email: variables.email })
            : result.mail === "not_configured"
              ? copy.notConfigured
              : copy.failed;
        onInvited({ severity: result.mail === "sent" ? "success" : "warning", text });
        setName("");
        setEmail("");
        setRoleId("");
        onClose();
      },
    })
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !email.trim() || !roleId) return;
    invite.mutate({ name: name.trim(), email: email.trim(), roleId, locale });
  }

  return (
    <Dialog open={open} onClose={invite.isPending ? undefined : onClose} fullWidth maxWidth="sm">
      <form onSubmit={submit} noValidate>
        <DialogTitle>{copy.title}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {copy.description}
            </Typography>
            {invite.error ? <Alert severity="error">{invite.error.message}</Alert> : null}
            <TextField
              label={copy.name}
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              autoFocus
              autoComplete="off"
              slotProps={{ htmlInput: { maxLength: 120 } }}
            />
            <TextField
              label={copy.email}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="off"
              slotProps={{ htmlInput: { maxLength: 254 } }}
            />
            <TextField select label={copy.role} value={roleId} onChange={(event) => setRoleId(event.target.value)} required>
              {roles.map((role) => (
                <MenuItem key={role.id} value={role.id}>
                  {role.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={invite.isPending}>
            {copy.cancel}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={invite.isPending || !name.trim() || !email.trim() || !roleId}
          >
            {invite.isPending ? copy.sending : copy.submit}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
