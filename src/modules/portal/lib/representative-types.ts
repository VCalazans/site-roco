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
  cnpj: string | null;
  phone: string | null;
  region: string | null;
  /** Observações do próprio representante (onboarding). */
  notes: string | null;
  /** Retorno do revisor (aprovação/rejeição). */
  reviewNotes: string | null;
  reviewedAt: string | null;
  submittedAt: string | null;
  createdAt: string;
  /**
   * Soft-disable (2026-08-23): `disabledAt != null` → admin desabilitou este
   * representante (login é recusado em `auth()`). O status real continua
   * visível para histórico. `disabledByName` vem do JOIN com `users` (FK
   * `disabledByUserId`) e é usado na UI para mostrar QUEM desabilitou.
   */
  disabledAt: string | null;
  disabledByUserId: string | null;
  disabledByName: string | null;
  disableReason: string | null;
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
  /** Filtro por região/território (match exato, case-insensitive). */
  region?: string;
  /** Busca textual em `user.name`, `user.email`, `companyName`, `cnpj`. */
  search?: string;
  /** Inclui representantes com `disabledAt IS NOT NULL`. Default `false`. */
  includeDisabled?: boolean;
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
  /** Quantos cadastros estão atualmente soft-disabled (independe do status). */
  disabled: number;
};

/**
 * Códigos de erro da edição do cadastro pelo admin — os mesmos que o servidor
 * devolve (`representatives.update`: zod `message` e `CONFLICT`), mapeados
 * para texto em `portal.representatives.edit.errors`.
 */
export type RepresentativeEditErrorCode =
  | "required"
  | "invalid_email"
  | "invalid_cnpj"
  | "invalid_phone"
  | "email_exists"
  | "cnpj_exists"
  | "generic";

export const REPRESENTATIVE_STATUS_TABS: RepresentativeStatus[] = [
  "submitted",
  "approved",
  "rejected",
  "draft",
];

export const DEFAULT_REPRESENTATIVES_PER_PAGE = 20;
