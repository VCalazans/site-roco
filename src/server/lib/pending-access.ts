import "server-only";
import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { representatives } from "@/db/schema";
import type { PendingAccessStatus } from "@/modules/portal/lib/types";

/** O que o aviso do `/portal` mostra para quem entrou sem perfil. */
export type PendingAccessRecord = {
  status: PendingAccessStatus;
  submittedAt: Date | null;
  companyName: string | null;
  /** Só em cadastro reprovado: o retorno do revisor ao representante. */
  reviewNotes: string | null;
};

/**
 * Situação do cadastro de representante do usuário — `none` quando a conta não
 * tem cadastro. Lida no servidor para o aviso nascer pronto, sem carregamento.
 */
export async function getPendingAccessRecord(userId: string): Promise<PendingAccessRecord> {
  const [row] = await db
    .select({
      id: representatives.id,
      status: representatives.status,
      submittedAt: representatives.submittedAt,
      companyName: representatives.companyName,
      cnpj: representatives.cnpj,
      onboardingStep: representatives.onboardingStep,
      reviewNotes: representatives.reviewNotes,
    })
    .from(representatives)
    .where(eq(representatives.userId, userId))
    .limit(1);

  if (!row) {
    return { status: "none", submittedAt: null, companyName: null, reviewNotes: null };
  }

  // Pré-cadastro do site ainda em rascunho (`onboardingStep = 0`) com outro
  // cadastro do mesmo CNPJ na fila ou aprovado: a confirmação do e-mail não o
  // pôs na fila (`applyEmailVerified`) — não há o que "concluir", é falar com a ROCO.
  if (row.status === "draft" && row.onboardingStep === 0 && row.cnpj) {
    const [conflict] = await db
      .select({ id: representatives.id })
      .from(representatives)
      .where(
        and(
          eq(representatives.cnpj, row.cnpj),
          ne(representatives.id, row.id),
          inArray(representatives.status, ["submitted", "approved"])
        )
      )
      .limit(1);
    if (conflict) {
      return { status: "cnpjConflict", submittedAt: null, companyName: row.companyName, reviewNotes: null };
    }
  }

  return {
    status: row.status,
    submittedAt: row.submittedAt,
    companyName: row.companyName,
    reviewNotes: row.status === "rejected" ? row.reviewNotes : null,
  };
}
