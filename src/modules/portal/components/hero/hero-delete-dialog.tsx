"use client";

import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import type { PortalDictionary } from "@/modules/portal/lib/types";

type HeroDeleteDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
  dictionary: PortalDictionary["hero"]["deleteConfirm"];
};

export function HeroDeleteDialog({
  open,
  onClose,
  onConfirm,
  isDeleting,
  dictionary,
}: HeroDeleteDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{dictionary.title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{dictionary.message}</DialogContentText>
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
