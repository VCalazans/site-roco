"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Stepper from "@mui/material/Stepper";
import Typography from "@mui/material/Typography";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/core/trpc-client";
import type { RepresentativeDocument } from "@/modules/portal/lib/onboarding-types";
import type { PortalDictionary } from "@/modules/portal/lib/types";
import { DocumentsStep } from "./steps/documents-step";
import { TerritoryStep } from "./steps/territory-step";

type ProfileCompletionProps = {
  portal: PortalDictionary;
  /** Valores já salvos no cadastro (pré-preenchem o form uma única vez). */
  initial: { region: string; notes: string };
  documents: RepresentativeDocument[];
};

const COMPLETION_STEPS = ["territory", "documents"] as const;

/**
 * Primeiro acesso do representante que veio pelo PRÉ-CADASTRO DO SITE: o
 * cadastro já nasce aprovado pelo time interno (CNPJ + dados principais), e
 * aqui ele completa o que falta — território de atuação e documentos. Ao
 * concluir (`completeProfile`), a query `me` é invalidada e o wizard pai
 * passa a renderizar o status `approved` normal.
 *
 * O estado inicial vem de `initial` no PRIMEIRO mount (useState initializer)
 * — mesmo padrão de hidratação única do wizard: refetches nunca sobrescrevem
 * o que o usuário está digitando.
 */
export function ProfileCompletion({ portal, initial, documents }: ProfileCompletionProps) {
  const dictionary = portal.onboarding;
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [activeStep, setActiveStep] = useState(0);
  const [region, setRegion] = useState(initial.region);
  const [notes, setNotes] = useState(initial.notes);
  const [regionError, setRegionError] = useState<string | undefined>(undefined);

  const completeMutation = useMutation(
    trpc.representatives.completeProfile.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.representatives.me.queryKey() });
      },
    })
  );

  const stepKey = COMPLETION_STEPS[activeStep];
  const isLastStep = activeStep === COMPLETION_STEPS.length - 1;

  // Janela entre o sucesso da mutation e o refetch de `me` no pai (que troca
  // este componente pelo status `approved`): mostra a confirmação, não o form.
  if (completeMutation.isSuccess) {
    return (
      <Alert severity="success" sx={{ maxWidth: 720 }}>
        {dictionary.completion.done}
      </Alert>
    );
  }

  function handleNext() {
    if (stepKey === "territory" && !region.trim()) {
      setRegionError(dictionary.validation.required);
      return;
    }
    setActiveStep((step) => Math.min(step + 1, COMPLETION_STEPS.length - 1));
  }

  async function handleFinish() {
    await completeMutation.mutateAsync({ region: region.trim(), notes });
  }

  return (
    <Stack spacing={4} sx={{ maxWidth: 720 }}>
      <Alert severity="success">
        <Typography sx={{ fontWeight: 600 }}>{dictionary.completion.title}</Typography>
        {dictionary.completion.subtitle}
      </Alert>

      <Stepper activeStep={activeStep} alternativeLabel>
        {COMPLETION_STEPS.map((key) => (
          <Step key={key}>
            <StepLabel>{dictionary.steps[key].title}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 } }}>
        <Typography variant="h6" component="h2" gutterBottom>
          {dictionary.steps[stepKey].title}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {dictionary.steps[stepKey].description}
        </Typography>

        {stepKey === "territory" ? (
          <TerritoryStep
            dictionary={dictionary}
            region={region}
            regionError={regionError}
            onRegionChange={(value) => {
              setRegion(value);
              setRegionError(undefined);
            }}
            notes={notes}
            onNotesChange={setNotes}
          />
        ) : null}

        {stepKey === "documents" ? (
          <DocumentsStep
            dictionary={dictionary}
            uploadErrorLabel={portal.products.form.images.uploadError}
            loadingLabel={portal.common.loading}
            documents={documents}
          />
        ) : null}

        {completeMutation.isError ? (
          <Alert severity="error" sx={{ mt: 3 }}>
            {portal.errors.generic}
          </Alert>
        ) : null}

        <Stack direction="row" sx={{ justifyContent: "space-between", mt: 4 }}>
          <Button
            onClick={() => setActiveStep((step) => Math.max(step - 1, 0))}
            disabled={activeStep === 0}
          >
            {dictionary.actions.back}
          </Button>

          {isLastStep ? (
            <Button
              variant="contained"
              onClick={handleFinish}
              disabled={completeMutation.isPending}
              startIcon={completeMutation.isPending ? <CircularProgress size={16} /> : null}
            >
              {dictionary.completion.finish}
            </Button>
          ) : (
            <Button variant="contained" onClick={handleNext}>
              {dictionary.actions.next}
            </Button>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
