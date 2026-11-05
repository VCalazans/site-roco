import { siteLinks } from "@/core/config/site";
import { getPresignedDownloadUrl } from "@/core/storage/r2";
import { buildContentDisposition } from "@/server/lib/content-disposition";
import { getCatalogFile } from "@/server/lib/site-settings";

export const dynamic = "force-dynamic";

/**
 * Entrega o catálogo em PDF: o arquivo enviado pelo portal ou, sem ele, o PDF
 * que vai na imagem. Sempre um arquivo: esta rota nunca leva a um site externo.
 *
 * Existe por dois motivos: a página não recebe URL assinada (venceria com a
 * aba aberta) e o arquivo fica em outro domínio, onde o navegador ignora o
 * atributo `download` e abriria o PDF em vez de baixar — quem força o download
 * é o `Content-Disposition` da URL assinada.
 *
 * É público de propósito: o formulário de `/catalogo` é uma captura de
 * marketing, não um controle de acesso (ver `catalogo/page.tsx`).
 */
async function resolveLocation(): Promise<string> {
  try {
    const file = await getCatalogFile();
    if (file) {
      return await getPresignedDownloadUrl(file.key, 60, {
        contentDisposition: buildContentDisposition("attachment", file.filename),
      });
    }
    return siteLinks.catalogPdf;
  } catch (error) {
    // Banco ou armazenamento fora do ar: entrega o PDF que vai na imagem.
    console.error("[catalog.download]", error instanceof Error ? error.message : "erro desconhecido");
    return siteLinks.catalogPdf;
  }
}

export async function GET() {
  return new Response(null, {
    status: 303,
    headers: {
      // Caminho interno segue relativo (no standalone, `nextUrl.origin` é o host de bind).
      Location: await resolveLocation(),
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
