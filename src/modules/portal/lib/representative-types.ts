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

/**
 * `representatives.list` pagina por página/tamanho (não por cursor, ao
 * contrário de `products.list`): input `{status?, page?, perPage?}`, retorno
 * `{items, total, page, perPage}` — o formato exato que `TablePagination` do
 * MUI consome (`page` 0-based no componente, 1-based aqui; conversão feita em
 * `representatives-page-client.tsx`).
 */
export type RepresentativeListInput = {
  status?: RepresentativeStatus;
  page?: number;
  perPage?: number;
};

export type RepresentativeListResult = {
  items: RepresentativeListItem[];
  total: number;
  page: number;
  perPage: number;
};

/** Espelho de `representatives.stats()` — usado nos cards do dashboard. */
export type RepresentativeStats = {
  total: number;
  draft: number;
  submitted: number;
  approved: number;
  rejected: number;
};

export const REPRESENTATIVE_STATUS_TABS: RepresentativeStatus[] = [
  "submitted",
  "approved",
  "rejected",
  "draft",
];

export const DEFAULT_REPRESENTATIVES_PER_PAGE = 20;
