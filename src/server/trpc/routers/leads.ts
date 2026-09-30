import "server-only";
import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq, gte, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { db as dbClient } from "@/db";
import { contactSubmissionItems, contactSubmissions } from "@/db/schema";
import { writeAuditLog } from "@/server/lib/audit";
import { CONTACT_SUBJECTS } from "@/server/lib/contact-submit";
import { containsPattern } from "@/server/lib/sql-like";
import { permissionProcedure, router } from "../init";

/**
 * Caixa de "Solicitações" do portal (spec 001, RF29): os leads que o site
 * grava em `contact_submissions` — pedidos de orçamento (produto único ou
 * lista), "ligamos pra você", contato geral e downloads do catálogo.
 *
 * SOMENTE LEITURA e atrás de `leads:read` (admin/gerente comercial): a tabela
 * tem dado pessoal. Minimização (LGPD): IP e user-agent — gravados só para
 * forense de abuso — NUNCA saem daqui; cada detalhe aberto gera audit log.
 */

type Database = typeof dbClient;

const RECENT_WINDOW_DAYS = 30;

/** Códigos gravados quando o canal não tem credencial — pendência, não falha. */
const UNCONFIGURED_CHANNEL_ERRORS = new Set(["not_configured", "missing_api_key"]);

/**
 * Status do canal para a LISTA: `failed` por falta de credencial vira
 * `not_configured` (a lista não carrega o texto do erro, e um "Falhou" vermelho
 * em toda linha — enquanto o Resend não é configurado — esconderia as falhas
 * de verdade).
 */
function listChannelStatus(status: string, error: string | null): string {
  return status === "failed" && error && UNCONFIGURED_CHANNEL_ERRORS.has(error) ? "not_configured" : status;
}

const listInputSchema = z.object({
  search: z.string().trim().max(120).optional(),
  subject: z.enum(CONTACT_SUBJECTS).optional(),
  page: z.number().int().min(1).max(10_000).default(1),
  perPage: z.number().int().min(5).max(100).default(20),
});

/**
 * Colunas expostas na LISTA — sem mensagem, IP, user-agent, UTM detalhada e
 * SEM e-mail/telefone: a tabela não os exibe, e devolvê-los permitiria
 * paginar a base inteira de contatos sem uma linha de auditoria (só o
 * `byId`, que traz os canais de contato, grava `leads.view` — revisão de
 * segurança 2026-09-30). A busca continua casando e-mail e telefone no banco.
 */
const listColumns = {
  id: contactSubmissions.id,
  createdAt: contactSubmissions.createdAt,
  subject: contactSubmissions.subject,
  name: contactSubmissions.name,
  companyName: contactSubmissions.companyName,
  productName: contactSubmissions.productName,
  productSku: contactSubmissions.productSku,
  origin: contactSubmissions.origin,
  locale: contactSubmissions.locale,
  rdStationStatus: contactSubmissions.rdStationStatus,
  emailStatus: contactSubmissions.emailStatus,
};

async function itemCountsFor(db: Database, ids: string[]) {
  const counts = new Map<string, { lines: number; units: number }>();
  if (ids.length === 0) return counts;
  const rows = await db
    .select({
      submissionId: contactSubmissionItems.submissionId,
      lines: count(),
      units: sql<number>`coalesce(sum(${contactSubmissionItems.quantity}), 0)::int`,
    })
    .from(contactSubmissionItems)
    .where(inArray(contactSubmissionItems.submissionId, ids))
    .groupBy(contactSubmissionItems.submissionId);
  for (const row of rows) counts.set(row.submissionId, { lines: row.lines, units: row.units });
  return counts;
}

function since(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export const leadsRouter = router({
  list: permissionProcedure("leads", "read")
    .input(listInputSchema)
    .query(async ({ ctx, input }) => {
      const conditions: SQL[] = [];
      if (input.subject) conditions.push(eq(contactSubmissions.subject, input.subject));
      if (input.search) {
        const term = containsPattern(input.search);
        conditions.push(
          or(
            ilike(contactSubmissions.name, term),
            ilike(contactSubmissions.email, term),
            ilike(contactSubmissions.companyName, term),
            ilike(contactSubmissions.phone, term),
            ilike(contactSubmissions.productName, term)
          )!
        );
      }
      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [{ total }] = await ctx.db.select({ total: count() }).from(contactSubmissions).where(where);
      const totalPages = Math.max(1, Math.ceil(total / input.perPage));
      const page = Math.min(input.page, totalPages);

      const rows =
        total === 0
          ? []
          : await ctx.db
              .select({
                ...listColumns,
                rdStationError: contactSubmissions.rdStationError,
                emailError: contactSubmissions.emailError,
              })
              .from(contactSubmissions)
              .where(where)
              .orderBy(desc(contactSubmissions.createdAt))
              .limit(input.perPage)
              .offset((page - 1) * input.perPage);

      const counts = await itemCountsFor(
        ctx.db,
        rows.map((row) => row.id)
      );

      return {
        items: rows.map(({ rdStationError, emailError, ...row }) => ({
          ...row,
          rdStationStatus: listChannelStatus(row.rdStationStatus, rdStationError),
          emailStatus: listChannelStatus(row.emailStatus, emailError),
          itemsCount: counts.get(row.id)?.lines ?? 0,
          unitsCount: counts.get(row.id)?.units ?? 0,
        })),
        total,
        page,
        perPage: input.perPage,
      };
    }),

  /** Detalhe completo (exceto IP/user-agent) + itens da lista de orçamento. Auditado. */
  byId: permissionProcedure("leads", "read")
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({
          ...listColumns,
          email: contactSubmissions.email,
          phone: contactSubmissions.phone,
          cnpj: contactSubmissions.cnpj,
          message: contactSubmissions.message,
          productSlug: contactSubmissions.productSlug,
          utmSource: contactSubmissions.utmSource,
          utmMedium: contactSubmissions.utmMedium,
          utmCampaign: contactSubmissions.utmCampaign,
          consentGranted: contactSubmissions.consentGranted,
          consentAt: contactSubmissions.consentAt,
          rdStationError: contactSubmissions.rdStationError,
          emailError: contactSubmissions.emailError,
        })
        .from(contactSubmissions)
        .where(eq(contactSubmissions.id, input.id))
        .limit(1);

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Solicitação não encontrada." });
      }

      const items = await ctx.db
        .select({
          productSlug: contactSubmissionItems.productSlug,
          productName: contactSubmissionItems.productName,
          productSku: contactSubmissionItems.productSku,
          quantity: contactSubmissionItems.quantity,
        })
        .from(contactSubmissionItems)
        .where(eq(contactSubmissionItems.submissionId, input.id))
        .orderBy(asc(contactSubmissionItems.sortOrder));

      // Visualizar dado pessoal é evento auditável (quem viu qual lead, quando).
      await writeAuditLog(ctx.db, ctx.session, {
        action: "leads.view",
        resource: "leads",
        resourceId: input.id,
      });

      return { ...row, items };
    }),

  /** Indicadores do dashboard: volume dos últimos 30 dias por assunto + 5 mais recentes. */
  stats: permissionProcedure("leads", "read").query(async ({ ctx }) => {
    const windowStart = since(RECENT_WINDOW_DAYS);

    const [bySubjectRows, [{ total }], recent] = await Promise.all([
      ctx.db
        .select({ subject: contactSubmissions.subject, total: count() })
        .from(contactSubmissions)
        .where(gte(contactSubmissions.createdAt, windowStart))
        .groupBy(contactSubmissions.subject),
      ctx.db.select({ total: count() }).from(contactSubmissions),
      ctx.db
        .select({
          id: contactSubmissions.id,
          createdAt: contactSubmissions.createdAt,
          subject: contactSubmissions.subject,
          name: contactSubmissions.name,
          companyName: contactSubmissions.companyName,
        })
        .from(contactSubmissions)
        .orderBy(desc(contactSubmissions.createdAt))
        .limit(5),
    ]);

    const bySubject = Object.fromEntries(CONTACT_SUBJECTS.map((subject) => [subject, 0])) as Record<
      (typeof CONTACT_SUBJECTS)[number],
      number
    >;
    for (const row of bySubjectRows) bySubject[row.subject] = row.total;
    const lastDays = bySubjectRows.reduce((sum, row) => sum + row.total, 0);

    return { windowDays: RECENT_WINDOW_DAYS, lastDays, bySubject, total, recent };
  }),
});
