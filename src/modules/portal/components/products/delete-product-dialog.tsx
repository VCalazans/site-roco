"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import type { PortalDictionary } from "@/modules/portal/lib/types";
import { interpolate } from "@/shared/lib/interpolate";

type DeleteProductDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
  dictionary: PortalDictionary["products"]["deleteConfirm"];
  /** Nome do produto a excluir — nomeia o alvo na mensagem de confirmação. */
  productName?: string;
};

export function DeleteProductDialog({
  open,
  onClose,
  onConfirm,
  isDeleting,
  dictionary,
  productName,
}: DeleteProductDialogProps) {
  // O pai zera o alvo ao fechar, e o diálogo ainda está no meio da animação de
  // saída: sem guardar o último nome a mensagem piscaria para a versão genérica.
  const [shownName, setShownName] = useState(productName);
  if (productName && productName !== shownName) {
    setShownName(productName);
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{dictionary.title}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {shownName ? interpolate(dictionary.messageNamed, { name: shownName }) : dictionary.message}
        </DialogContentText>
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
