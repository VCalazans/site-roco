import { NextResponse, type NextRequest } from "next/server";
import { parseBestSeller } from "@/modules/products/lib/listing-filters";
import { getPublicProductList } from "@/server/lib/public-products";
import { checkRateLimit, getClientIp } from "@/server/lib/rate-limit";

const CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=60";

/** Compartilhado com `/api/products/[slug]` — um único "balde" por IP para a REST pública. */
const PUBLIC_PRODUCTS_RATE_LIMIT = { windowSeconds: 60, max: 120 };

/**
 * Catálogo público de produtos. Dados de leitura pública — sem autenticação.
 * `?category=<slug>&search=<termo>&bestSeller=1&page=<n>&perPage=<n>` —
 * `category` e `search` podem se REPETIR: categorias combinam em OU, termos
 * de busca em E (ver `@/modules/products/lib/listing-filters`). A validação e
 * os tetos de cada lista ficam em `getPublicProductList`.
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
    const pageParam = Number(searchParams.get("page"));
    const perPageParam = Number(searchParams.get("perPage"));

    const result = await getPublicProductList({
      categories: searchParams.getAll("category"),
      searchTerms: searchParams.getAll("search"),
      // Só "1"/"true" liga o filtro — qualquer outro valor é ignorado.
      bestSeller: parseBestSeller(searchParams.get("bestSeller")),
      page: Number.isFinite(pageParam) ? pageParam : undefined,
      perPage: Number.isFinite(perPageParam) ? perPageParam : undefined,
    });

    return NextResponse.json(result, { status: 200, headers: { "Cache-Control": CACHE_CONTROL } });
  } catch (error) {
    console.error("[api/products]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
