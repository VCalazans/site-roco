import type { RepresentativeStatus } from "./onboarding-types";

/**
 * Espelho local do item de `representatives.list()` (contrato tRPC — ver
 * relatório final). `documentsUrl`/`documents` viriam do backend já
 * resolvidos (URLs assinadas de leitura), conforme a missão: "link p/
 * documentos (URLs vêm do backend)".
 */
export type RepresentativeListItem = {
  id: string;
  status: RepresentativeStatus;
  companyName: string | null;
  region: string | null;
  submittedAt: string | null;
  createdAt: string;
  user: {
    name: string | null;
    email: string | null;
  };
  documents: { id: string; filename: string; url: string }[];
};

export const REPRESENTATIVE_STATUS_TABS: RepresentativeStatus[] = [
  "submitted",
  "approved",
  "rejected",
  "draft",
];
