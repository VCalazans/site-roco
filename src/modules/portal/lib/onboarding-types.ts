/**
 * Espelho local do shape esperado de `representatives.me()` (contrato tRPC —
 * ver relatório final para o texto completo combinado com o backend). Usado
 * para tipar props/estado dos componentes de onboarding enquanto o router
 * `representatives` não é mergeado em `src/server/trpc/routers/_app.ts`
 * (nesse meio-tempo `trpc.representatives.me.queryOptions()` não compila —
 * este tipo por si só não depende do router e continua útil depois do merge
 * como o "formato esperado" documentado).
 */
export type RepresentativeStatus = "draft" | "submitted" | "approved" | "rejected";

export type RepresentativeDocument = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
};

export type RepresentativeMe = {
  id: string;
  status: RepresentativeStatus;
  onboardingStep: number;
  companyName: string | null;
  cnpj: string | null;
  phone: string | null;
  region: string | null;
  notes: string | null;
  documents: RepresentativeDocument[];
  reviewedAt: string | null;
  notesFromReviewer?: string | null;
} | null;

export type OnboardingFormState = {
  phone: string;
  companyName: string;
  cnpj: string;
  region: string;
  notes: string;
};

export const EMPTY_ONBOARDING_FORM: OnboardingFormState = {
  phone: "",
  companyName: "",
  cnpj: "",
  region: "",
  notes: "",
};

export const ONBOARDING_STEP_KEYS = [
  "personal",
  "company",
  "territory",
  "documents",
  "review",
] as const;

export type OnboardingStepKey = (typeof ONBOARDING_STEP_KEYS)[number];
