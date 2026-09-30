import type { NextRequest } from "next/server";
import { db } from "@/db";
import { getDictionary } from "@/i18n/get-dictionary";
import { exceedsZipLimits } from "@/modules/portal/lib/product-images";
import { getPortalDictionary } from "@/modules/portal/lib/types";
import { writeAuditLog } from "@/server/lib/audit";
import { buildContentDisposition } from "@/server/lib/content-disposition";
import { authorizePortalRoute, NO_STORE_HEADERS, plainTextResponse } from "@/server/lib/portal-route-auth";
import { loadImagesZipRows, resolveImagesZipScope } from "@/server/lib/product-images-download";
import { imageZipSlots, streamImagesZip } from "@/server/lib/product-images-zip";
import { checkRateLimit } from "@/server/lib/rate-limit";
import { buildImageZipEntries } from "@/server/lib/zip-entry-names";
import { interpolate } from "@/shared/lib/interpolate";

/**
 * `GET /api/portal/products/images/zip?product=<id>` — todas as imagens de um produto;
 * `GET /api/portal/products/images/zip?<filtros da tabela>` — as de todos os produtos
 * do filtro (sem filtro: o catálogo inteiro), uma pasta por produto.
 *
 * Arquivos ORIGINAIS, sem recompressão (inclusive os que não aparecem no
 * site), montados em fluxo a partir do R2 — o download começa na hora e a
 * memória não cresce com o tamanho. Sessão + `product_images:download` no
 * clique; limite de ZIPs por usuário na janela E de ZIPs simultâneos no
 * processo (`imageZipSlots`); cada download fica no audit log.
 */
export const dynamic = "force-dynamic";

/**
 * ZIPs por usuário na janela — um catálogo inteiro leva minutos, 20 em 10 min
 * é folga de uso real. Fail-open (sem Redis, não limita) de propósito: o que
 * protege o processo é o teto de ZIPs simultâneos, que vive em memória e não
 * depende do Redis; fechar a rota sem Redis tiraria o download de todos.
 */
const ZIP_RATE_LIMIT = { windowSeconds: 10 * 60, max: 20 };

/** AAAA-MM-DD no fuso da ROCO (o nome do ZIP é para gente, não para máquina). */
function todayInBrazil(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export async function GET(request: NextRequest) {
  const access = await authorizePortalRoute(
    request,
    { resource: "product_images", action: "download" },
    (locale) => `/${locale}/portal/produtos`
  );
  if (access.status === "unauthenticated") return access.response;

  const downloads = getPortalDictionary(await getDictionary(access.locale)).products.downloads;
  if (access.status === "forbidden") return plainTextResponse(403, downloads.errors.forbidden);

  const scope = resolveImagesZipScope(request.nextUrl.searchParams);
  if (scope.kind === "invalid") return plainTextResponse(404, downloads.errors.notFound);

  const rateLimit = await checkRateLimit(`images-zip:user:${access.session.user.id}`, ZIP_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return plainTextResponse(429, downloads.errors.rateLimited, {
      "Retry-After": String(rateLimit.retryAfterSeconds),
    });
  }

  const rows = await loadImagesZipRows(db, scope);
  if (rows.length === 0) {
    return plainTextResponse(404, scope.kind === "product" ? downloads.errors.notFound : downloads.errors.empty);
  }

  const totalBytes = rows.reduce((sum, row) => sum + row.sizeBytes, 0);
  if (exceedsZipLimits({ imageCount: rows.length, totalBytes })) {
    return plainTextResponse(413, downloads.errors.tooLarge);
  }

  const acquired = imageZipSlots().tryAcquire(access.session.user.id);
  if (!acquired.ok) {
    return plainTextResponse(429, downloads.errors.busy, { "Retry-After": "30" });
  }

  // A vaga só é devolvida pelo stream (`onClose`); qualquer falha antes dele nascer a devolve aqui.
  try {
    const productCount = new Set(rows.map((row) => row.productId)).size;
    await writeAuditLog(db, access.session, {
      action: "product_images.download",
      resource: "products",
      resourceId: scope.kind === "product" ? scope.productId : null,
      metadata: {
        scope: scope.kind,
        ...(scope.kind === "filters" ? { filters: scope.filters } : {}),
        productCount,
        imageCount: rows.length,
        totalBytes,
      },
    });

    const entries = buildImageZipEntries(rows, { groupByProduct: scope.kind !== "product" });
    const zipName =
      scope.kind === "product"
        ? interpolate(downloads.productZipName, { sku: rows[0].sku })
        : interpolate(downloads.catalogZipName, { date: todayInBrazil() });

    const body = streamImagesZip(entries, downloads.failureReport, { onClose: acquired.slot.release });
    return new Response(body, {
      headers: {
        ...NO_STORE_HEADERS,
        "Content-Type": "application/zip",
        "Content-Disposition": buildContentDisposition("attachment", `${zipName}.zip`),
      },
    });
  } catch (error) {
    acquired.slot.release();
    throw error;
  }
}
