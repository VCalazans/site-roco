import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getPresignedDownloadUrl } from "@/core/storage/r2";
import { db } from "@/db";
import { getDictionary } from "@/i18n/get-dictionary";
import { getPortalDictionary } from "@/modules/portal/lib/types";
import { buildContentDisposition } from "@/server/lib/content-disposition";
import { authorizePortalRoute, NO_STORE_HEADERS, plainTextResponse } from "@/server/lib/portal-route-auth";
import { loadDownloadableImage } from "@/server/lib/product-images-download";

/**
 * `GET /api/portal/products/images/[imageId]/download`
 *
 * Uma imagem de produto, ORIGINAL (os bytes do upload, sem o otimizador do
 * site), com o nome do arquivo enviado. Sessão + `product_images:download`
 * conferidas NO CLIQUE; depois, 303 para uma URL do R2 gerada na hora (60 s
 * bastam para o redirect) com `Content-Disposition: attachment` — o navegador
 * salva em vez de abrir. Vale também para as imagens que não aparecem no site.
 */
export const dynamic = "force-dynamic";

const DOWNLOAD_URL_TTL_SECONDS = 60;
const idSchema = z.string().uuid();

export async function GET(request: NextRequest, { params }: { params: Promise<{ imageId: string }> }) {
  const access = await authorizePortalRoute(
    request,
    { resource: "product_images", action: "download" },
    (locale) => `/${locale}/portal/produtos`
  );
  if (access.status === "unauthenticated") return access.response;

  const errors = getPortalDictionary(await getDictionary(access.locale)).products.downloads.errors;
  if (access.status === "forbidden") return plainTextResponse(403, errors.forbidden);

  const imageId = idSchema.safeParse((await params).imageId);
  const image = imageId.success ? await loadDownloadableImage(db, imageId.data) : null;
  if (!image) return plainTextResponse(404, errors.notFound);

  let url: string;
  try {
    url = await getPresignedDownloadUrl(image.r2Key, DOWNLOAD_URL_TTL_SECONDS, {
      contentDisposition: buildContentDisposition("attachment", image.filename),
    });
  } catch (error) {
    console.error("[product-images.download] Falha ao gerar a URL de leitura no R2.", error);
    return plainTextResponse(503, errors.unavailable);
  }

  return NextResponse.redirect(url, { status: 303, headers: NO_STORE_HEADERS });
}
