"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { RepresentativeListItem } from "@/modules/portal/lib/representative-types";
import type { PortalDictionary } from "@/modules/portal/lib/types";

type ReviewDecision = "approved" | "rejected";

type ReviewDialogProps = {
  representative: RepresentativeListItem | null;
  decision: ReviewDecision | null;
  onClose: () => void;
  onConfirm: (notes: string) => void;
  isSubmitting: boolean;
  dictionary: PortalDictionary["representatives"];
  commonDictionary: PortalDictionary["common"];
};

/** Dialog de aprovar/rejeitar com campo de anotações (`review.notesLabel`). */
export function ReviewDialog({
  representative,
  decision,
  onClose,
  onConfirm,
  isSubmitting,
  dictionary,
  commonDictionary,
}: ReviewDialogProps) {
  const [notes, setNotes] = useState("");

  const open = Boolean(representative && decision);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{ transition: { onExited: () => setNotes("") } }}
    >
      <DialogTitle>
        {decision === "approved" ? dictionary.review.approve : dictionary.review.reject}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography color="text.secondary">{representative?.companyName}</Typography>
          <TextField
            label={dictionary.review.notesLabel}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            multiline
            minRows={3}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{commonDictionary.cancel}</Button>
        <Button
          variant="contained"
          color={decision === "rejected" ? "error" : "primary"}
          onClick={() => onConfirm(notes)}
          disabled={isSubmitting}
          startIcon={isSubmitting ? <CircularProgress size={16} /> : null}
        >
          {commonDictionary.confirm}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
