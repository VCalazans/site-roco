import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { hasPermission } from "@/core/auth/rbac";
import { getPresignedDownloadUrl } from "@/core/storage/r2";
import { db } from "@/db";
import { materials } from "@/db/schema/materials";
import { getDictionary } from "@/i18n/get-dictionary";
import { getPortalDictionary } from "@/modules/portal/lib/types";
import { buildContentDisposition } from "@/server/lib/content-disposition";
import { authorizePortalRoute, NO_STORE_HEADERS, plainTextResponse } from "@/server/lib/portal-route-auth";

/**
 * `GET /api/portal/materials/[id]/download?modo=abrir|baixar`
 *
 * Link ESTÁVEL de um material de apoio (revisão 2026-09-30). A biblioteca do
 * representante embutia URLs presignadas do R2 que vencem em 5 minutos — quem
 * deixava a página aberta e clicava depois recebia um erro do R2 e concluía
 * que o material não existia. Agora o link aponta para cá: a sessão e a
 * permissão são conferidas NO CLIQUE e só então o navegador é redirecionado
 * para uma URL do R2 recém-gerada (60 s bastam para o redirect).
 *
 * Regras: exige sessão + `materials:read`; rascunho só para quem gerencia
 * materiais (`materials:create` — pré-visualização do admin); para os demais
 * um rascunho é indistinguível de inexistente (404). A chave do R2 nunca sai
 * daqui. O objeto continua PRIVADO (decisionLog 2026-08-24).
 */
export const dynamic = "force-dynamic";

const DOWNLOAD_URL_TTL_SECONDS = 60;
const idSchema = z.string().uuid();

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizePortalRoute(
    request,
    { resource: "materials", action: "read" },
    // Sessão expirada: depois de entrar, volta à biblioteca de materiais.
    (locale) => `/${locale}/portal/materiais`
  );
  if (access.status === "unauthenticated") return access.response;

  const errors = getPortalDictionary(await getDictionary(access.locale)).materials.downloadErrors;
  if (access.status === "forbidden") return plainTextResponse(403, errors.forbidden);

  const parsedId = idSchema.safeParse((await params).id);
  if (!parsedId.success) return plainTextResponse(404, errors.notFound);

  const [row] = await db
    .select({ r2Key: materials.r2Key, filename: materials.filename, published: materials.published })
    .from(materials)
    .where(eq(materials.id, parsedId.data))
    .limit(1);

  if (!row || (!row.published && !hasPermission(access.session, "materials", "create"))) {
    return plainTextResponse(404, errors.notFound);
  }

  const mode = request.nextUrl.searchParams.get("modo") === "abrir" ? "inline" : "attachment";
  let url: string;
  try {
    url = await getPresignedDownloadUrl(row.r2Key, DOWNLOAD_URL_TTL_SECONDS, {
      contentDisposition: buildContentDisposition(mode, row.filename),
    });
  } catch (error) {
    console.error("[materials.download] Falha ao gerar a URL de leitura no R2.", error);
    return plainTextResponse(503, errors.unavailable);
  }

  return NextResponse.redirect(url, { status: 303, headers: NO_STORE_HEADERS });
}
