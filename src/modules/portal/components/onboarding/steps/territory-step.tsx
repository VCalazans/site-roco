"use client";

import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import type { PortalDictionary } from "@/modules/portal/lib/types";

type TerritoryStepProps = {
  dictionary: PortalDictionary["onboarding"];
  region: string;
  regionError?: string;
  onRegionChange: (value: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
};

/** Passo 3: região de atuação (obrigatória) + observações (livres). */
export function TerritoryStep({
  dictionary,
  region,
  regionError,
  onRegionChange,
  notes,
  onNotesChange,
}: TerritoryStepProps) {
  return (
    <Stack spacing={2.5} sx={{ maxWidth: 480 }}>
      <TextField
        label={dictionary.fields.region}
        value={region}
        onChange={(event) => onRegionChange(event.target.value)}
        error={Boolean(regionError)}
        helperText={regionError}
        fullWidth
      />
      <TextField
        label={dictionary.fields.notes}
        value={notes}
        onChange={(event) => onNotesChange(event.target.value)}
        multiline
        minRows={3}
        fullWidth
      />
    </Stack>
  );
}
