import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { OnboardingFormState, RepresentativeDocument } from "@/modules/portal/lib/onboarding-types";
import type { PortalDictionary } from "@/modules/portal/lib/types";

type ReviewStepProps = {
  dictionary: PortalDictionary["onboarding"];
  sessionUser: { name?: string | null; email?: string | null };
  form: OnboardingFormState;
  documents: RepresentativeDocument[];
};

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" spacing={2} sx={{ justifyContent: "space-between" }}>
      <Typography color="text.secondary">{label}</Typography>
      <Typography sx={{ fontWeight: 600, textAlign: "right" }}>{value || "—"}</Typography>
    </Stack>
  );
}

/** Passo 5: resumo somente-leitura de tudo preenchido nos passos anteriores. */
export function ReviewStep({ dictionary, sessionUser, form, documents }: ReviewStepProps) {
  return (
    <Stack spacing={1.5} sx={{ maxWidth: 480 }}>
      <ReviewRow label={dictionary.fields.fullName} value={sessionUser.name ?? ""} />
      <ReviewRow label={dictionary.fields.email} value={sessionUser.email ?? ""} />
      <ReviewRow label={dictionary.fields.phone} value={form.phone} />
      <Divider />
      <ReviewRow label={dictionary.fields.companyName} value={form.companyName} />
      <ReviewRow label={dictionary.fields.cnpj} value={form.cnpj} />
      <Divider />
      <ReviewRow label={dictionary.fields.region} value={form.region} />
      <ReviewRow label={dictionary.fields.notes} value={form.notes} />
      <Divider />
      <Stack direction="row" sx={{ justifyContent: "space-between" }}>
        <Typography color="text.secondary">{dictionary.steps.documents.title}</Typography>
        <Typography sx={{ fontWeight: 600 }}>{documents.length}</Typography>
      </Stack>
    </Stack>
  );
}
