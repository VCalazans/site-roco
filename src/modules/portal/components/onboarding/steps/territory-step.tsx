"use client";

import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { TerritoryPicker } from "@/modules/portal/components/shared/territory-picker";
import type { PortalDictionary, PortalTerritoryDictionary } from "@/modules/portal/lib/types";
import type { TerritoryOption } from "@/shared/lib/territory";

type TerritoryStepProps = {
  dictionary: PortalDictionary["onboarding"];
  territoryCopy: PortalTerritoryDictionary;
  territory: TerritoryOption[];
  territoryError?: string;
  onTerritoryChange: (value: TerritoryOption[]) => void;
  notes: string;
  onNotesChange: (value: string) => void;
};

/** Passo 3: área de atuação (obrigatória, da base do IBGE) + observações (livres). */
export function TerritoryStep({
  dictionary,
  territoryCopy,
  territory,
  territoryError,
  onTerritoryChange,
  notes,
  onNotesChange,
}: TerritoryStepProps) {
  return (
    <Stack spacing={2.5} sx={{ maxWidth: 640 }}>
      <TerritoryPicker value={territory} onChange={onTerritoryChange} copy={territoryCopy} error={territoryError} />
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
