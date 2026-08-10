import { NextResponse, type NextRequest } from "next/server";
import { getPublicProductBySlug } from "@/server/lib/public-products";
import { checkRateLimit, getClientIp } from "@/server/lib/rate-limit";

const CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=60";

/** Compartilhado com `/api/products` — um único "balde" por IP para a REST pública. */
const PUBLIC_PRODUCTS_RATE_LIMIT = { windowSeconds: 60, max: 120 };

/** Detalhe público de um produto por slug — somente publicado e ativo. */
export async function GET(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit(`products:ip:${ip}`, PUBLIC_PRODUCTS_RATE_LIMIT);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
      );
    }

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
