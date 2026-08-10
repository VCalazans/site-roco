"use client";

import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { formatPhoneBR } from "@/modules/portal/lib/phone";
import type { PortalDictionary } from "@/modules/portal/lib/types";

type PersonalStepProps = {
  dictionary: PortalDictionary["onboarding"];
  sessionUser: { name?: string | null; email?: string | null };
  phone: string;
  phoneError?: string;
  onPhoneChange: (value: string) => void;
};

/** Passo 1: nome/email vêm read-only da sessão Google — só `phone` é editável. */
export function PersonalStep({
  dictionary,
  sessionUser,
  phone,
  phoneError,
  onPhoneChange,
}: PersonalStepProps) {
  return (
    <Stack spacing={2.5} sx={{ maxWidth: 480 }}>
      <TextField
        label={dictionary.fields.fullName}
        value={sessionUser.name ?? ""}
        slotProps={{ input: { readOnly: true } }}
        fullWidth
      />
      <TextField
        label={dictionary.fields.email}
        value={sessionUser.email ?? ""}
        slotProps={{ input: { readOnly: true } }}
        fullWidth
      />
      <TextField
        label={dictionary.fields.phone}
        value={phone}
        onChange={(event) => onPhoneChange(formatPhoneBR(event.target.value))}
        error={Boolean(phoneError)}
        helperText={phoneError}
        placeholder="(00) 00000-0000"
        fullWidth
      />
    </Stack>
  );
}
