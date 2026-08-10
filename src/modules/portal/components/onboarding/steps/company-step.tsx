"use client";

import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { formatCNPJ } from "@/shared/components/contact-form/cnpj";
import type { PortalDictionary } from "@/modules/portal/lib/types";

type CompanyStepProps = {
  dictionary: PortalDictionary["onboarding"];
  companyName: string;
  companyNameError?: string;
  onCompanyNameChange: (value: string) => void;
  cnpj: string;
  cnpjError?: string;
  onCnpjChange: (value: string) => void;
};

/** Passo 2: razão social + CNPJ (máscara/validação reaproveitadas de `cnpj.ts`). */
export function CompanyStep({
  dictionary,
  companyName,
  companyNameError,
  onCompanyNameChange,
  cnpj,
  cnpjError,
  onCnpjChange,
}: CompanyStepProps) {
  return (
    <Stack spacing={2.5} sx={{ maxWidth: 480 }}>
      <TextField
        label={dictionary.fields.companyName}
        value={companyName}
        onChange={(event) => onCompanyNameChange(event.target.value)}
        error={Boolean(companyNameError)}
        helperText={companyNameError}
        fullWidth
      />
      <TextField
        label={dictionary.fields.cnpj}
        value={cnpj}
        onChange={(event) => onCnpjChange(formatCNPJ(event.target.value))}
        error={Boolean(cnpjError)}
        helperText={cnpjError}
        placeholder="00.000.000/0000-00"
        fullWidth
      />
    </Stack>
  );
}
