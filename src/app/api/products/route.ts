import { NextResponse, type NextRequest } from "next/server";
import { getPublicProductList } from "@/server/lib/public-products";
import { checkRateLimit, getClientIp } from "@/server/lib/rate-limit";

const CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=60";

/** Compartilhado com `/api/products/[slug]` — um único "balde" por IP para a REST pública. */
const PUBLIC_PRODUCTS_RATE_LIMIT = { windowSeconds: 60, max: 120 };

/**
 * Catálogo público de produtos. Dados de leitura pública — sem autenticação.
 * `?category=<slug>&search=<termo>&page=<n>&perPage=<n>`.
 */
export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit(`products:ip:${ip}`, PUBLIC_PRODUCTS_RATE_LIMIT);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
      );
    }

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
