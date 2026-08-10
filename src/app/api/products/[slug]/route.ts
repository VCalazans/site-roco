import { NextResponse, type NextRequest } from "next/server";
import { getPublicProductBySlug } from "@/server/lib/public-products";

const CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=60";

/** Detalhe público de um produto por slug — somente publicado e ativo. */
export async function GET(_request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    if (!slug) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const product = await getPublicProductBySlug(slug);
    if (!product) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(product, { status: 200, headers: { "Cache-Control": CACHE_CONTROL } });
  } catch (error) {
    console.error("[api/products/[slug]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
