import { NextResponse, type NextRequest } from "next/server";
import { getPublicProductList } from "@/server/lib/public-products";

const CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=60";

/**
 * Catálogo público de produtos. Dados de leitura pública — sem autenticação.
 * `?category=<slug>&search=<termo>&page=<n>&perPage=<n>`.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const category = searchParams.get("category")?.trim() || undefined;
    const search = searchParams.get("search")?.trim() || undefined;
    const pageParam = Number(searchParams.get("page"));
    const perPageParam = Number(searchParams.get("perPage"));

    const result = await getPublicProductList({
      category,
      search,
      page: Number.isFinite(pageParam) ? pageParam : undefined,
      perPage: Number.isFinite(perPageParam) ? perPageParam : undefined,
    });

    return NextResponse.json(result, { status: 200, headers: { "Cache-Control": CACHE_CONTROL } });
  } catch (error) {
    console.error("[api/products]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
