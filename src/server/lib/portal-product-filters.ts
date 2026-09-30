import "server-only";
import { and, eq, exists, not, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { db as dbClient } from "@/db";
import { productCategories, productImages, products } from "@/db/schema";
import { matchAllTerms } from "@/server/lib/sql-like";

type Database = typeof dbClient;

/**
 * Filtros da listagem de produtos do portal. Fonte ÚNICA das regras: a
 * tabela (`products.list`), o resumo do download de imagens
 * (`products.imagesSummary`) e o ZIP (`/api/portal/products/images/zip`)
 * filtram exatamente o mesmo conjunto — o que a pessoa vê na tabela é o que
 * ela baixa.
 */
export const portalProductFiltersSchema = z.object({
  search: z.string().trim().min(1).max(200).optional(),
  categoryId: z.string().uuid().optional(),
  published: z.boolean().optional(),
  /** Filtros de vitrine/saúde do catálogo (spec 001, RF10). */
  featured: z.boolean().optional(),
  bestSeller: z.boolean().optional(),
  /**
   * Tem imagem VISÍVEL NO SITE? `false` = "Sem foto no site": o produto aparece
   * com o espaço reservado para a foto, mesmo que tenha imagens só no portal.
   */
  hasSiteImage: z.boolean().optional(),
  /** Inclui produtos excluídos (soft delete, `active = false`). Padrão: só ativos. */
  includeInactive: z.boolean().optional(),
});

export type PortalProductFilters = z.infer<typeof portalProductFiltersSchema>;

/** O produto (da linha externa da consulta) tem ao menos uma imagem marcada para o site? */
export function siteImageExists(db: Database): SQL {
  return exists(
    db
      .select({ one: sql`1` })
      .from(productImages)
      .where(and(eq(productImages.productId, products.id), eq(productImages.showOnSite, true)))
  );
}

/** Condição SQL dos filtros sobre a tabela `products` (`undefined` = sem filtro). */
export function portalProductConditions(db: Database, filters: PortalProductFilters): SQL | undefined {
  const conditions: SQL[] = [];

  // Produto "excluído" é soft delete (`active = false`): não aparece a menos
  // que se peça explicitamente.
  if (!filters.includeInactive) conditions.push(eq(products.active, true));
  if (filters.published !== undefined) conditions.push(eq(products.published, filters.published));
  if (filters.featured !== undefined) conditions.push(eq(products.featured, filters.featured));
  if (filters.bestSeller !== undefined) conditions.push(eq(products.bestSeller, filters.bestSeller));

  if (filters.hasSiteImage !== undefined) {
    const withSiteImage = siteImageExists(db);
    conditions.push(filters.hasSiteImage ? withSiteImage : not(withSiteImage));
  }

  if (filters.search) {
    // Mesma busca do site: todas as palavras, sem acento/caixa, em SKU,
    // código ERP, nome PT ou EN (termos escapados — LIKE literal).
    const match = matchAllTerms(filters.search, [products.sku, products.erpCode, products.namePt, products.nameEn]);
    if (match) conditions.push(match);
  }

  if (filters.categoryId) {
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(productCategories)
          .where(
            and(eq(productCategories.productId, products.id), eq(productCategories.categoryId, filters.categoryId))
          )
      )
    );
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}
