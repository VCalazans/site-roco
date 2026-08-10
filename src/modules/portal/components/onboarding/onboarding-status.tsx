import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HourglassTopIcon from "@mui/icons-material/HourglassTop";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { RepresentativeStatus } from "@/modules/portal/lib/onboarding-types";
import type { PortalDictionary } from "@/modules/portal/lib/types";

type OnboardingStatusViewProps = {
  status: Exclude<RepresentativeStatus, "draft">;
  dictionary: PortalDictionary["onboarding"];
  reviewerNotes?: string | null;
};

const STATUS_COLOR: Record<
  Exclude<RepresentativeStatus, "draft">,
  "warning" | "success" | "error"
> = {
  submitted: "warning",
  approved: "success",
  rejected: "error",
};

const STATUS_ICON: Record<Exclude<RepresentativeStatus, "draft">, typeof HourglassTopIcon> = {
  submitted: HourglassTopIcon,
  approved: CheckCircleIcon,
  rejected: HighlightOffIcon,
};

/**
 * Tela exibida no lugar do wizard quando `representatives.me().status` já é
 * `submitted`/`approved`/`rejected` — não faz sentido reabrir os passos.
 * `submitted` reaproveita a copy de `portal.onboarding.submitted.*`; os
 * demais status usam apenas o Chip de `portal.onboarding.status.*` (não há
 * mensagens dedicadas de "aprovado"/"rejeitado" no dicionário — ver
 * relatório final).
 */
export function OnboardingStatusView({
  status,
  dictionary,
  reviewerNotes,
}: OnboardingStatusViewProps) {
  const Icon = STATUS_ICON[status];

  return (
    <Paper variant="outlined" sx={{ p: { xs: 3, sm: 5 }, textAlign: "center", maxWidth: 560 }}>
      <Stack spacing={2} sx={{ alignItems: "center" }}>
        <Icon color={STATUS_COLOR[status]} sx={{ fontSize: 56 }} />
        <Chip
          label={dictionary.status[status]}
          color={STATUS_COLOR[status]}
          variant="outlined"
        />
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
          {status === "submitted" ? dictionary.submitted.title : dictionary.status[status]}
        </Typography>
        <Typography color="text.secondary">
          {status === "submitted" ? dictionary.submitted.message : null}
        </Typography>
        {reviewerNotes ? (
          <Box sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {reviewerNotes}
            </Typography>
          </Box>
        ) : null}
      </Stack>
    </Paper>
  );
}
