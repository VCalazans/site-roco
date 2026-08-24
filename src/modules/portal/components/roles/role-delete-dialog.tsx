"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import type { PortalDictionary } from "@/modules/portal/lib/types";

type RoleDeleteDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
  dictionary: PortalDictionary["roles"]["deleteConfirm"];
  /** Erro real do servidor (fallback, já que o botão de excluir nasce
   *  desabilitado nos dois casos detectáveis no client — ver
   *  `roles-profiles-tab.tsx`). */
  errorMessage?: string | null;
};

/** Mirror de `hero-delete-dialog.tsx`, com uma nota de bloqueio permanente. */
export function RoleDeleteDialog({
  open,
  onClose,
  onConfirm,
  isDeleting,
  dictionary,
  errorMessage,
}: RoleDeleteDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{dictionary.title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <DialogContentText>{dictionary.message}</DialogContentText>
          <Alert severity="info">{dictionary.blockedMessage}</Alert>
          {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{dictionary.cancel}</Button>
        <Button
          color="error"
          variant="contained"
          onClick={onConfirm}
          disabled={isDeleting}
          startIcon={isDeleting ? <CircularProgress size={16} /> : null}
        >
          {dictionary.confirm}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
