import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/core/auth";
import { hasPermission } from "@/core/auth/rbac";
import { getPresignedDownloadUrl } from "@/core/storage/r2";
import { db } from "@/db";
import { materials } from "@/db/schema/materials";
import { buildContentDisposition } from "@/server/lib/content-disposition";
import { defaultLocale, locales } from "@/i18n/config";

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
const NO_STORE = { "Cache-Control": "no-store" };
const idSchema = z.string().uuid();

function plainText(status: number, message: string) {
  return new NextResponse(message, {
    status,
    headers: { ...NO_STORE, "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    // Sessão expirada: volta ao login do portal no idioma do visitante e, depois
    // de entrar, para a biblioteca de materiais.
    const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
    const locale = (locales as readonly string[]).includes(cookieLocale ?? "") ? cookieLocale : defaultLocale;
    const loginUrl = new URL(`/${locale}/portal/login`, request.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", `/${locale}/portal/materiais`);
    return NextResponse.redirect(loginUrl, { status: 303, headers: NO_STORE });
  }

  if (!hasPermission(session, "materials", "read")) {
    return plainText(403, "Sem permissão para acessar materiais. / No permission to access materials.");
  }

  const { id } = await params;
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return plainText(404, "Material não encontrado. / Material not found.");
  }

  const [row] = await db
    .select({ r2Key: materials.r2Key, filename: materials.filename, published: materials.published })
    .from(materials)
    .where(eq(materials.id, parsedId.data))
    .limit(1);

  if (!row || (!row.published && !hasPermission(session, "materials", "create"))) {
    return plainText(404, "Material não encontrado. / Material not found.");
  }

  const mode = request.nextUrl.searchParams.get("modo") === "abrir" ? "inline" : "attachment";
  let url: string;
  try {
    url = await getPresignedDownloadUrl(row.r2Key, DOWNLOAD_URL_TTL_SECONDS, {
      contentDisposition: buildContentDisposition(mode, row.filename),
    });
  } catch (error) {
    console.error("[materials.download] Falha ao gerar a URL de leitura no R2.", error);
    return plainText(503, "Arquivo indisponível no momento. Tente novamente. / File temporarily unavailable.");
  }

  return NextResponse.redirect(url, { status: 303, headers: NO_STORE });
}
