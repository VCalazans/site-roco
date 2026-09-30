"use client";

import { useState, type ReactNode } from "react";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SaveIcon from "@mui/icons-material/Save";
import UndoIcon from "@mui/icons-material/Undo";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { Locale } from "@/i18n/config";
import type { PortalHomeContentDictionary } from "@/modules/portal/lib/home-content-dictionary";
import { interpolate } from "@/shared/lib/interpolate";
import { formatSavedAt } from "./home-editor-model";

type SectionEditorFrameProps = {
  headingId: string;
  title: string;
  description: string;
  locale: Locale;
  dictionary: PortalHomeContentDictionary["editor"];
  /** Há conteúdo salvo desta seção (habilita "Restaurar padrão"). */
  hasSaved: boolean;
  /** Última gravação (ISO) — só faz sentido com `hasSaved`. */
  updatedAt: string | Date | null;
  dirty: boolean;
  canEdit: boolean;
  saving: boolean;
  resetting: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onReset: () => void;
  children: ReactNode;
};

/**
 * Moldura comum dos editores de seção: cabeçalho com o estado (padrão /
 * personalizada / não salva), corpo do formulário e barra de ações fixa no
 * rodapé da janela — o formulário de categorias é longo, e "Salvar" não pode
 * ficar fora da tela.
 */
export function SectionEditorFrame({
  headingId,
  title,
  description,
  locale,
  dictionary,
  hasSaved,
  updatedAt,
  dirty,
  canEdit,
  saving,
  resetting,
  onSave,
  onDiscard,
  onReset,
  children,
}: SectionEditorFrameProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const busy = saving || resetting;

  return (
    <Paper variant="outlined" component="section" aria-labelledby={headingId} sx={{ overflow: "visible" }}>
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" } }}
        >
          <Box>
            <Typography id={headingId} variant="h5" component="h2" sx={{ fontWeight: 700 }}>
              {title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          </Box>
          {dirty ? (
            <Chip color="warning" size="small" label={dictionary.statusUnsaved} />
          ) : hasSaved ? (
            <Chip color="primary" variant="outlined" size="small" label={dictionary.statusCustom} />
          ) : (
            <Chip variant="outlined" size="small" label={dictionary.statusDefault} />
          )}
        </Stack>
        {hasSaved && updatedAt ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            {interpolate(dictionary.lastUpdated, { date: formatSavedAt(updatedAt, locale) })}
          </Typography>
        ) : null}
        {!hasSaved ? (
          <Alert severity="info" variant="outlined" sx={{ mt: 2 }}>
            {dictionary.defaultsNote}
          </Alert>
        ) : null}
      </Box>

      <Divider />

      <Box sx={{ p: { xs: 2, sm: 3 } }}>{children}</Box>

      {canEdit ? (
        <>
          <Box
            sx={{
              position: "sticky",
              bottom: 0,
              zIndex: 2,
              bgcolor: "background.paper",
              borderTop: 1,
              borderColor: "divider",
              borderBottomLeftRadius: "inherit",
              borderBottomRightRadius: "inherit",
              px: { xs: 2, sm: 3 },
              py: 1.5,
            }}
          >
            <Stack
              direction={{ xs: "column-reverse", sm: "row" }}
              spacing={1.5}
              sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
            >
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }} useFlexGap>
                <Button
                  color="inherit"
                  startIcon={<RestartAltIcon />}
                  disabled={!hasSaved || busy}
                  onClick={() => setConfirmOpen(true)}
                >
                  {dictionary.reset}
                </Button>
                <Button color="inherit" startIcon={<UndoIcon />} disabled={!dirty || busy} onClick={onDiscard}>
                  {dictionary.discard}
                </Button>
              </Stack>
              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                disabled={!dirty || busy}
                onClick={onSave}
              >
                {saving ? dictionary.saving : dictionary.save}
              </Button>
            </Stack>
          </Box>
        </>
      ) : null}

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
        aria-labelledby={`${headingId}-reset-title`}
      >
        <DialogTitle id={`${headingId}-reset-title`}>{dictionary.resetDialog.title}</DialogTitle>
        <DialogContent>
          <DialogContentText>{dictionary.resetDialog.message}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>{dictionary.resetDialog.cancel}</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              setConfirmOpen(false);
              onReset();
            }}
          >
            {dictionary.resetDialog.confirm}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
