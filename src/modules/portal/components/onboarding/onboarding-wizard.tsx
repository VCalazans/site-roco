"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Stepper from "@mui/material/Stepper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/core/trpc-client";
import { isValidCNPJ } from "@/shared/components/contact-form/cnpj";
import {
  EMPTY_ONBOARDING_FORM,
  ONBOARDING_STEP_KEYS,
  type OnboardingFormState,
  type OnboardingStepKey,
} from "@/modules/portal/lib/onboarding-types";
import { isValidPhoneBR } from "@/modules/portal/lib/phone";
import type { PortalDictionary } from "@/modules/portal/lib/types";
import { OnboardingStatusView } from "./onboarding-status";
import { ProfileCompletion } from "./profile-completion";
import { CompanyStep } from "./steps/company-step";
import { DocumentsStep } from "./steps/documents-step";
import { PersonalStep } from "./steps/personal-step";
import { ReviewStep } from "./steps/review-step";
import { TerritoryStep } from "./steps/territory-step";

type OnboardingWizardProps = {
  portal: PortalDictionary;
  sessionUser: { name?: string | null; email?: string | null };
};

type FormErrors = Partial<Record<keyof OnboardingFormState, string>>;

function validateStep(
  step: OnboardingStepKey,
  form: OnboardingFormState,
  dictionary: PortalDictionary["onboarding"]
): FormErrors {
  const errors: FormErrors = {};

  if (step === "personal") {
    if (!form.phone.trim()) {
      errors.phone = dictionary.validation.required;
    } else if (!isValidPhoneBR(form.phone)) {
      errors.phone = dictionary.validation.invalidPhone;
    }
  }

  if (step === "company") {
    if (!form.companyName.trim()) {
      errors.companyName = dictionary.validation.required;
    }
    if (!form.cnpj.trim()) {
      errors.cnpj = dictionary.validation.required;
    } else if (!isValidCNPJ(form.cnpj)) {
      errors.cnpj = dictionary.validation.invalidCnpj;
    }
  }

  if (step === "territory" && !form.region.trim()) {
    errors.region = dictionary.validation.required;
  }

  return errors;
}

/**
 * Orquestrador do wizard de onboarding (MUI `Stepper`, 5 passos). Autosave:
 * cada "Avançar" chama `saveOnboarding` (upsert do rascunho) antes de mudar
 * de passo; "Enviar" (último passo) chama `submitOnboarding`. Se
 * `representatives.me()` já retornar status `submitted`/`approved`/
 * `rejected`, o wizard não é renderizado — `OnboardingStatusView` assume o
 * lugar.
 */
export function OnboardingWizard({ portal, sessionUser }: OnboardingWizardProps) {
  const dictionary = portal.onboarding;
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const meQuery = useQuery(trpc.representatives.me.queryOptions());

  const [activeStep, setActiveStep] = useState(0);
  const [form, setForm] = useState<OnboardingFormState>(EMPTY_ONBOARDING_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  // Hidrata o form/step a partir do rascunho salvo UMA ÚNICA VEZ, no primeiro
  // render em que a query resolve (padrão "adjusting state during render" da
  // doc do React — `react-hooks/set-state-in-effect` proíbe o equivalente em
  // efeito). O guard é um booleano deliberadamente: comparar por REFERÊNCIA de
  // `meQuery.data` re-hidratava a cada refetch (autosave invalida a query;
  // foco na janela refaz a busca) e SOBRESCREVIA o que o usuário estava
  // digitando, além de devolvê-lo ao passo salvo — o form local é a fonte de
  // verdade depois da primeira carga.
  const [hasHydrated, setHasHydrated] = useState(false);
  if (!meQuery.isPending && !hasHydrated) {
    setHasHydrated(true);
    const representative = meQuery.data;
    if (representative) {
      setForm({
        phone: representative.phone ?? "",
        companyName: representative.companyName ?? "",
        cnpj: representative.cnpj ?? "",
        region: representative.region ?? "",
        notes: representative.notes ?? "",
      });
      setActiveStep(
        Math.min(representative.onboardingStep ?? 0, ONBOARDING_STEP_KEYS.length - 1)
      );
    }
  }

  const saveMutation = useMutation(
    trpc.representatives.saveOnboarding.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.representatives.me.queryKey() });
      },
    })
  );

  const submitMutation = useMutation(
    trpc.representatives.submitOnboarding.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.representatives.me.queryKey() });
      },
    })
  );

  if (meQuery.isPending) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (meQuery.isError) {
    return <Alert severity="error">{portal.errors.generic}</Alert>;
  }

  const status = meQuery.data?.status ?? "draft";

  // Fluxo do pré-cadastro pelo site: aprovado ANTES de completar o perfil —
  // o primeiro acesso preenche território/documentos (`completeProfile`).
  // Quando `region` já existe, o perfil está completo e cai no status normal.
  if (status === "approved" && !meQuery.data?.region) {
    return (
      <ProfileCompletion
        portal={portal}
        initial={{ region: "", notes: meQuery.data?.notes ?? "" }}
        documents={meQuery.data?.documents ?? []}
      />
    );
  }

  if (status !== "draft") {
    return (
      <OnboardingStatusView
        status={status}
        dictionary={dictionary}
        reviewerNotes={meQuery.data?.notesFromReviewer}
      />
    );
  }

  const stepKey = ONBOARDING_STEP_KEYS[activeStep];
  const isLastStep = activeStep === ONBOARDING_STEP_KEYS.length - 1;

  function updateField<K extends keyof OnboardingFormState>(key: K, value: OnboardingFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function handleBack() {
    setActiveStep((step) => Math.max(step - 1, 0));
  }

  async function handleNext() {
    const stepErrors = validateStep(stepKey, form, dictionary);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length > 0) {
      return;
    }

    if (stepKey !== "documents" && stepKey !== "review") {
      // Salva o passo de DESTINO (não o atual): se o usuário sair e voltar,
      // o rascunho reabre onde ele parou, não um passo antes.
      await saveMutation.mutateAsync({ step: activeStep + 1, data: form });
    }
    setActiveStep((step) => Math.min(step + 1, ONBOARDING_STEP_KEYS.length - 1));
  }

  async function handleSubmit() {
    await saveMutation.mutateAsync({ step: activeStep, data: form });
    await submitMutation.mutateAsync();
  }

  const documents = meQuery.data?.documents ?? [];

  return (
    <Stack spacing={4} sx={{ maxWidth: 720 }}>
      <Stepper activeStep={activeStep} alternativeLabel>
        {ONBOARDING_STEP_KEYS.map((key) => (
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

        {stepKey === "personal" ? (
          <PersonalStep
            dictionary={dictionary}
            sessionUser={sessionUser}
            phone={form.phone}
            phoneError={errors.phone}
            onPhoneChange={(value) => updateField("phone", value)}
          />
        ) : null}

        {stepKey === "company" ? (
          <CompanyStep
            dictionary={dictionary}
            companyName={form.companyName}
            companyNameError={errors.companyName}
            onCompanyNameChange={(value) => updateField("companyName", value)}
            cnpj={form.cnpj}
            cnpjError={errors.cnpj}
            onCnpjChange={(value) => updateField("cnpj", value)}
          />
        ) : null}

        {stepKey === "territory" ? (
          <TerritoryStep
            dictionary={dictionary}
            region={form.region}
            regionError={errors.region}
            onRegionChange={(value) => updateField("region", value)}
            notes={form.notes}
            onNotesChange={(value) => updateField("notes", value)}
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

        {stepKey === "review" ? (
          <ReviewStep
            dictionary={dictionary}
            sessionUser={sessionUser}
            form={form}
            documents={documents}
          />
        ) : null}

        {saveMutation.isError || submitMutation.isError ? (
          <Alert severity="error" sx={{ mt: 3 }}>
            {portal.errors.generic}
          </Alert>
        ) : null}

        <Stack direction="row" sx={{ justifyContent: "space-between", mt: 4 }}>
          <Button onClick={handleBack} disabled={activeStep === 0}>
            {dictionary.actions.back}
          </Button>

          {isLastStep ? (
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
              startIcon={submitMutation.isPending ? <CircularProgress size={16} /> : null}
            >
              {dictionary.actions.submit}
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={saveMutation.isPending}
              startIcon={saveMutation.isPending ? <CircularProgress size={16} /> : null}
            >
              {dictionary.actions.next}
            </Button>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
