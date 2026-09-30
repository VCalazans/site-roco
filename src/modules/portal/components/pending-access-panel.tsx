"use client";

import NextLink from "next/link";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import EditNoteIcon from "@mui/icons-material/EditNote";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import HourglassTopIcon from "@mui/icons-material/HourglassTop";
import LockClockIcon from "@mui/icons-material/LockClock";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import Alert, { type AlertColor } from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Stepper from "@mui/material/Stepper";
import Typography from "@mui/material/Typography";
import type { PendingAccessStatus, PortalPendingAccessDictionary } from "@/modules/portal/lib/types";
import { interpolate } from "@/shared/lib/interpolate";

type PendingAccessPanelProps = {
  greeting: string;
  status: PendingAccessStatus;
  /** Data do envio já formatada no servidor (`formatSubmittedDate`), ou `null`. */
  submittedAt: string | null;
  companyName: string | null;
  /** Retorno do revisor — só chega preenchido em cadastro reprovado. */
  reviewNotes: string | null;
  copy: PortalPendingAccessDictionary;
  links: { onboarding: string; contact: string; site: string };
};

const SEVERITY: Record<PendingAccessStatus, AlertColor> = {
  submitted: "info",
  approved: "success",
  rejected: "warning",
  draft: "info",
  cnpjConflict: "warning",
  none: "info",
};

const ICON: Record<PendingAccessStatus, typeof HourglassTopIcon> = {
  submitted: HourglassTopIcon,
  approved: CheckCircleIcon,
  rejected: HighlightOffIcon,
  draft: EditNoteIcon,
  cnpjConflict: ReportProblemIcon,
  none: LockClockIcon,
};

/** Etapa ativa da linha "enviado → análise → acesso" (só para enviado/aprovado). */
const ACTIVE_STEP: Partial<Record<PendingAccessStatus, number>> = { submitted: 1, approved: 2 };

/**
 * Aviso que substitui o painel para quem entrou no portal SEM perfil — quem fez o
 * pré-cadastro e espera a análise. Sem ele, a pessoa via um painel vazio e não
 * sabia se o cadastro tinha chegado nem o que esperar. Mostra a situação do
 * cadastro (em análise, aprovado mas com a sessão ainda sem o perfil,
 * reprovado, rascunho, CNPJ já em análise noutro cadastro ou sem cadastro),
 * as etapas e o caminho de contato.
 */
export function PendingAccessPanel({
  greeting,
  status,
  submittedAt,
  companyName,
  reviewNotes,
  copy,
  links,
}: PendingAccessPanelProps) {
  const Icon = ICON[status];
  const title = copy[status].title;
  const message =
    status === "submitted" && submittedAt
      ? interpolate(copy.submitted.messageWithDate, { date: submittedAt })
      : copy[status].message;
  const activeStep = ACTIVE_STEP[status];

  return (
    <Box sx={{ maxWidth: 760, mx: "auto" }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {greeting}
      </Typography>

      <Alert
        severity={SEVERITY[status]}
        icon={<Icon fontSize="inherit" />}
        role="status"
        sx={{ mb: 3, alignItems: "flex-start" }}
      >
        <AlertTitle sx={{ fontWeight: 700 }}>{title}</AlertTitle>
        <Stack spacing={1}>
          <span>{message}</span>
          {companyName ? <span>{interpolate(copy.company, { company: companyName })}</span> : null}
        </Stack>
      </Alert>

      {activeStep !== undefined ? (
        <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3 }, mb: 3 }}>
          <Typography variant="subtitle2" component="h2" sx={{ mb: 2.5 }}>
            {copy.steps.title}
          </Typography>
          <Stepper activeStep={activeStep} alternativeLabel>
            {[copy.steps.sent, copy.steps.review, copy.steps.access].map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
          {status === "submitted" ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 3, textAlign: "center" }}>
              {copy.submitted.hint}
            </Typography>
          ) : null}
        </Paper>
      ) : null}

      {reviewNotes ? (
        <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3 }, mb: 3 }}>
          <Typography variant="subtitle2" component="h2" gutterBottom>
            {copy.rejected.notesLabel}
          </Typography>
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
            {reviewNotes}
          </Typography>
        </Paper>
      ) : null}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
        {status === "draft" ? (
          <Button variant="contained" component={NextLink} href={links.onboarding}>
            {copy.draft.action}
          </Button>
        ) : null}
        <Button variant={status === "draft" ? "outlined" : "contained"} href={links.contact}>
          {copy.contactAction}
        </Button>
        <Button variant="text" href={links.site}>
          {copy.siteAction}
        </Button>
      </Stack>
    </Box>
  );
}
